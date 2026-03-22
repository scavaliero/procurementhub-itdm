import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller has manage_users or review_documents grant
    const supabaseCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerUser } = await supabaseCaller.auth.getUser();
    if (!callerUser?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has the right grant
    const { data: hasGrant } = await supabaseAdmin.rpc("user_has_grant", {
      grant_name: "review_documents",
    });

    const { supplier_id, ban } = await req.json();

    if (!supplier_id) {
      return new Response(JSON.stringify({ error: "supplier_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the auth user linked to this supplier
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("supplier_id", supplier_id)
      .limit(1)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "no_profile_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ban) {
      // Ban the user — prevents login
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { ban_duration: "876600h" } // ~100 years
      );
      if (banErr) throw banErr;

      // Also deactivate the profile
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_active: false })
        .eq("id", profile.id);
      if (profErr) console.error("Profile deactivate error:", profErr);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: profile.id, banned: !!ban }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ban-supplier-user error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
