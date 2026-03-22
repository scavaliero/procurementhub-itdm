import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Find auth users older than 7 days that have NO profile (orphan users)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw listErr;

    const orphanUsers = listed.users.filter(
      (u) => u.created_at && u.created_at < cutoff,
    );

    let deletedCount = 0;

    for (const user of orphanUsers) {
      // Check if this user has a profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        // Orphan user — delete
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (!delErr) {
          deletedCount++;
          console.log(`Deleted orphan user: ${user.email} (created: ${user.created_at})`);
        } else {
          console.error(`Failed to delete orphan user ${user.email}:`, delErr);
        }
      }
    }

    // Also clean up suppliers in pre_registered status with no associated profile user
    const { data: preRegSuppliers } = await supabaseAdmin
      .from("suppliers")
      .select("id, created_at")
      .eq("status", "pre_registered")
      .lt("created_at", cutoff);

    let deletedSuppliers = 0;

    if (preRegSuppliers) {
      for (const sup of preRegSuppliers) {
        const { data: supProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("supplier_id", sup.id)
          .maybeSingle();

        if (!supProfile) {
          // Orphan supplier with no user
          await supabaseAdmin.from("supplier_status_history").delete().eq("supplier_id", sup.id);
          await supabaseAdmin.from("supplier_categories").delete().eq("supplier_id", sup.id);
          await supabaseAdmin.from("suppliers").delete().eq("id", sup.id);
          deletedSuppliers++;
          console.log(`Deleted orphan supplier: ${sup.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_users: deletedCount,
        deleted_suppliers: deletedSuppliers,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Cleanup error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore nel cleanup" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
