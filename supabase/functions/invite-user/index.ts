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

    // Create the auth user with a temporary password (auto-confirmed)
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (signUpErr) throw signUpErr;
    if (!signUpData.user) throw new Error("Utente non creato");

    const userId = signUpData.user.id;

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

    // Generate a recovery (password reset) link
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr) {
      console.error("Link generation error:", linkErr);
    }

    const actionLink = linkData?.properties?.action_link;

    // Send invite email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@vendorhub.it";

    if (resendKey && actionLink) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Sei stato invitato su Procurement Hub",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a2e;">Benvenuto su Procurement Hub</h2>
              <p>Ciao <strong>${fullName}</strong>,</p>
              <p>Sei stato invitato ad accedere alla piattaforma Procurement Hub come utente interno.</p>
              <p>Clicca il pulsante qui sotto per impostare la tua password di accesso:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${actionLink}" style="background-color: #1a1a2e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Imposta Password</a>
              </div>
              <p style="color: #666; font-size: 14px;">Se non hai richiesto questo invito, puoi ignorare questa email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">Procurement Hub — ITDM Group</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error("Resend error:", errBody);
      }
    } else {
      console.warn("Resend not configured or link not generated, invite email not sent");
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
