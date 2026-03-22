import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_name, vat_number, contact_name, email, phone, pec, password, category_id } = await req.json();

    if (!company_name || !vat_number || !email || !password || !contact_name) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: contact_name },
      email_confirm: false,
    });
    if (authErr) throw authErr;
    const userId = authData.user?.id;
    if (!userId) throw new Error("Utente non creato");

    // 2. Get active tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (!tenant) throw new Error("Nessun tenant configurato");
    const tenantId = tenant.id;

    // 3. Create supplier
    const { data: supplier, error: supErr } = await supabaseAdmin
      .from("suppliers")
      .insert({
        company_name,
        vat_number_hash: btoa(vat_number),
        pec: pec || null,
        status: "pre_registered",
        tenant_id: tenantId,
      })
      .select("id")
      .single();
    if (supErr) throw supErr;

    // 4. Create profile
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: contact_name,
        phone: phone || null,
        user_type: "supplier",
        supplier_id: supplier.id,
        tenant_id: tenantId,
      });
    if (profErr) throw profErr;

    // 5. Assign "Fornitore" role
    const { data: supplierRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "Fornitore")
      .eq("is_system", true)
      .maybeSingle();
    if (supplierRole) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role_id: supplierRole.id });
    }

    // 6. Status history
    await supabaseAdmin
      .from("supplier_status_history")
      .insert({
        supplier_id: supplier.id,
        to_status: "pre_registered",
        changed_by: userId,
      });

    // 7. Category association
    if (category_id) {
      await supabaseAdmin.from("supplier_categories").insert({
        supplier_id: supplier.id,
        category_id,
        status: "pending",
      });
    }

    // 8. Notifications (non-blocking)
    try {
      await supabaseAdmin.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_id: userId,
          tenant_id: tenantId,
          variables: { company_name },
        },
      });
      await supabaseAdmin.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_email: "procurement@itdm.it",
          tenant_id: tenantId,
          variables: { company_name, contact_name, email },
        },
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    return new Response(
      JSON.stringify({ userId, supplierId: supplier.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Registration error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Errore nella registrazione" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
