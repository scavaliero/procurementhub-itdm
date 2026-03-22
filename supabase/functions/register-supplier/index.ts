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

    // 2) Create auth user — email_confirm: true so NO confirmation email is sent.
    //    Supplier is pre_registered; activation email sent when admin enables.
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      user_metadata: { full_name: contactName },
      email_confirm: true,
    });

    if (authErr) {
      const isDuplicateEmail =
        authErr.message?.includes("already been registered") ||
        authErr.message?.includes("already exists");

      if (!isDuplicateEmail) throw authErr;

      // Existing account: if not confirmed, resend confirmation mail
      const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listErr) throw listErr;

      const existingUser = listed.users.find(
        (u) => (u.email ?? "").toLowerCase() === normalizedEmail,
      );

      if (existingUser && !existingUser.email_confirmed_at) {
        const { error: resendErr } = await anonClient.auth.resend({
          type: "signup",
          email: normalizedEmail,
        });
        if (resendErr) throw resendErr;

        return new Response(
          JSON.stringify({
            resent: true,
            message: "Email di conferma re-inviata. Controlla la tua casella di posta.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      throw new Error("Questa email è già registrata e confermata. Usa la funzione 'Password dimenticata' per recuperare l'accesso.");
    }

    createdUserId = authData.user?.id ?? null;
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
