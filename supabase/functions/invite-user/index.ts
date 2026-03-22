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
    // Verify the caller is authenticated and has manage_users grant
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller with anon client
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has manage_users grant
    const { data: grants } = await supabaseAdmin
      .from("user_effective_grants")
      .select("grant_name")
      .eq("user_id", caller.id)
      .eq("grant_name", "manage_users");

    if (!grants || grants.length === 0) {
      return new Response(JSON.stringify({ error: "Permesso negato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const fullName = String(payload.full_name ?? "").trim();
    const tenantId = String(payload.tenant_id ?? "").trim();
    const redirectTo = payload.redirect_to ? String(payload.redirect_to).trim() : undefined;

    if (!email || !fullName || !tenantId) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({ error: "Questa email è già registrata nel sistema" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin invite which sends a magic link / set password email
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName },
        redirectTo,
      },
    );

    if (inviteErr) throw inviteErr;
    if (!inviteData.user) throw new Error("Utente non creato");

    const userId = inviteData.user.id;

    // Create profile
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName,
      user_type: "internal",
      tenant_id: tenantId,
    });

    if (profErr) {
      // Rollback: delete the auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (_) { /* no-op */ }
      throw profErr;
    }

    return new Response(
      JSON.stringify({ userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("invite-user error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore nell'invito" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
