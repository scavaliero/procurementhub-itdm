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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Sessione non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check manage_users grant
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

    const { action, user_id, redirect_to } = await req.json();

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: "user_id e action sono obbligatori" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent self-modification for destructive actions
    if (
      caller.id === user_id &&
      ["deactivate", "delete"].includes(action)
    ) {
      return new Response(
        JSON.stringify({ error: "Non puoi eseguire questa azione su te stesso" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get target profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Utente non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "resend_invite": {
        // Generate a recovery (password reset) link
        const { data: linkData, error: linkErr } =
          await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: profile.email,
            options: { redirectTo: redirect_to || undefined },
          });

        if (linkErr) throw linkErr;

        const actionLink = linkData?.properties?.action_link;
        if (!actionLink) throw new Error("Impossibile generare il link");

        // Send via Resend
        const resendKey = Deno.env.get("RESEND_API_KEY");
        const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@vendorhub.it";

        if (resendKey) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [profile.email],
              subject: "Imposta la tua password — Procurement Hub",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a2e;">Procurement Hub</h2>
                  <p>Ciao <strong>${profile.full_name}</strong>,</p>
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
            // Don't fail the whole operation - link was generated successfully
          }
        } else {
          console.warn("RESEND_API_KEY non configurata, link generato ma email non inviata");
        }

        // Log audit
        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: caller.id,
          entity_type: "user",
          entity_id: user_id,
          event_type: "invite_resent",
          new_state: { email: profile.email },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Invito re-inviato con successo" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activate": {
        // Unban auth user
        const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { ban_duration: "none" }
        );
        if (unbanErr) console.error("Unban error:", unbanErr);

        // Activate profile
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({ is_active: true })
          .eq("id", user_id);
        if (profErr) throw profErr;

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: caller.id,
          entity_type: "user",
          entity_id: user_id,
          event_type: "user_activated",
          old_state: { is_active: false },
          new_state: { is_active: true },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Utente attivato" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate": {
        // Ban auth user
        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { ban_duration: "876600h" }
        );
        if (banErr) console.error("Ban error:", banErr);

        // Deactivate profile
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({ is_active: false })
          .eq("id", user_id);
        if (profErr) throw profErr;

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: caller.id,
          entity_type: "user",
          entity_id: user_id,
          event_type: "user_deactivated",
          old_state: { is_active: true },
          new_state: { is_active: false },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Utente disattivato" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        // Delete profile first
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", user_id);
        if (profErr) console.error("Profile delete error:", profErr);

        // Delete user_roles
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", user_id);

        // Delete auth user
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (delErr) throw delErr;

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id: profile.tenant_id,
          user_id: caller.id,
          entity_type: "user",
          entity_id: user_id,
          event_type: "user_deleted",
          old_state: { email: profile.email, full_name: profile.full_name },
        });

        return new Response(
          JSON.stringify({ success: true, message: "Utente eliminato" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Azione '${action}' non supportata` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    console.error("manage-internal-user error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
