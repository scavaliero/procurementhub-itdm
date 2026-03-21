import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_type, recipient_id, variables, tenant_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch email template
    const { data: template, error: tplErr } = await supabase
      .from("email_templates")
      .select("subject, html_body")
      .eq("event_type", event_type)
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (tplErr) throw tplErr;
    if (!template) {
      return new Response(
        JSON.stringify({ error: "template_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch recipient email
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", recipient_id)
      .maybeSingle();

    if (profErr) throw profErr;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "recipient_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Replace {{variables}} in subject and html_body
    const vars: Record<string, string> = variables || {};
    const replaceVars = (text: string) =>
      Object.entries(vars).reduce(
        (acc, [key, val]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val),
        text
      );

    const subject = replaceVars(template.subject);
    const html_body = replaceVars(template.html_body);

    // 4. Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@vendorhub.it";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [profile.email],
        subject,
        html: html_body,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      // Still insert notification even if email fails
    }

    // 5. Insert notification
    const { error: notifErr } = await supabase.from("notifications").insert({
      tenant_id,
      recipient_id,
      event_type,
      title: subject,
      body: html_body,
      is_read: false,
    });

    if (notifErr) {
      console.error("Notification insert error:", notifErr);
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailRes.ok }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
