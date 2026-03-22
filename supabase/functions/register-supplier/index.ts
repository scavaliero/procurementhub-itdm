import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  let createdUserId: string | null = null;
  let createdSupplierId: string | null = null;

  try {
    const payload = await req.json();
    const companyName = String(payload.company_name ?? "").trim();
    const vatNumber = String(payload.vat_number ?? "").trim();
    const contactName = String(payload.contact_name ?? "").trim();
    const normalizedEmail = String(payload.email ?? "").trim().toLowerCase();
    const phone = payload.phone ? String(payload.phone).trim() : null;
    const pec = payload.pec ? String(payload.pec).trim().toLowerCase() : null;
    const password = String(payload.password ?? "");
    const categoryId = payload.category_id ? String(payload.category_id).trim() : null;

    if (!companyName || !vatNumber || !normalizedEmail || !password || !contactName) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Resolve active tenant BEFORE creating auth user (prevents orphan users)
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (tenantErr) throw tenantErr;
    if (!tenant?.id) throw new Error("Nessun tenant configurato");
    const tenantId = tenant.id;

    // 2) Create auth user with standard signup flow so confirmation email is sent reliably
    const redirectToRaw = payload.redirect_to ? String(payload.redirect_to).trim() : "";
    const emailRedirectTo = redirectToRaw || undefined;

    const { data: signupData, error: signupErr } = await anonClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: contactName },
        emailRedirectTo,
      },
    });

    if (signupErr) {
      throw signupErr;
    }

    const signedUpUser = signupData.user;
    const isExistingUser =
      !!signedUpUser && Array.isArray(signedUpUser.identities) && signedUpUser.identities.length === 0;

    if (!signedUpUser || isExistingUser) {
      throw new Error("Questa email è già registrata. Usa la funzione 'Password dimenticata' per recuperare l'accesso.");
    }

    createdUserId = signedUpUser.id;

    if (!createdUserId) throw new Error("Utente non creato");

    // 3) Create supplier
    const { data: supplier, error: supErr } = await supabaseAdmin
      .from("suppliers")
      .insert({
        company_name: companyName,
        vat_number_hash: btoa(vatNumber),
        pec,
        status: "pre_registered",
        tenant_id: tenantId,
      })
      .select("id")
      .single();

    if (supErr) throw supErr;
    createdSupplierId = supplier.id;

    // 4) Create profile
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: createdUserId,
        email: normalizedEmail,
        full_name: contactName,
        phone,
        user_type: "supplier",
        supplier_id: createdSupplierId,
        tenant_id: tenantId,
      });
    if (profErr) throw profErr;

    // 5) Assign "Fornitore" role
    const { data: supplierRole, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "Fornitore")
      .eq("is_system", true)
      .maybeSingle();
    if (roleErr) throw roleErr;

    if (supplierRole) {
      const { error: roleAssignErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: createdUserId, role_id: supplierRole.id });
      if (roleAssignErr) throw roleAssignErr;
    }

    // 6) Status history
    const { error: historyErr } = await supabaseAdmin
      .from("supplier_status_history")
      .insert({
        supplier_id: createdSupplierId,
        to_status: "pre_registered",
        changed_by: createdUserId,
      });
    if (historyErr) throw historyErr;

    // 7) Category association (optional)
    if (categoryId) {
      const { error: categoryErr } = await supabaseAdmin.from("supplier_categories").insert({
        supplier_id: createdSupplierId,
        category_id: categoryId,
        status: "pending",
      });
      if (categoryErr) throw categoryErr;
    }

    // 8) Notifications (non-blocking)
    try {
      await supabaseAdmin.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_id: createdUserId,
          tenant_id: tenantId,
          link_url: "/supplier/onboarding",
          related_entity_id: createdSupplierId,
          related_entity_type: "supplier",
          variables: { company_name: companyName },
        },
      });

      await supabaseAdmin.functions.invoke("send-notification", {
        body: {
          event_type: "pre_registration",
          recipient_email: "procurement@itdm.it",
          tenant_id: tenantId,
          variables: { company_name: companyName, contact_name: contactName, email: normalizedEmail },
        },
      });
    } catch (e) {
      console.error("Notification error:", e);
    }

    return new Response(
      JSON.stringify({ userId: createdUserId, supplierId: createdSupplierId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    // Rollback to avoid orphan records if any step fails after user creation
    if (createdUserId) {
      try {
        await supabaseAdmin.from("profiles").delete().eq("id", createdUserId);
      } catch (_) {
        // no-op
      }
    }

    if (createdSupplierId) {
      try {
        await supabaseAdmin.from("suppliers").delete().eq("id", createdSupplierId);
      } catch (_) {
        // no-op
      }
    }

    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch (_) {
        // no-op
      }
    }

    console.error("Registration error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore nella registrazione" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
