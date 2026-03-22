import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const eventLabels: Record<string, string> = {
  order_issued: "Nuovo ordine",
  order_accepted: "Ordine accettato",
  order_rejected: "Ordine rifiutato",
  billing_pending_approval: "Benestare in attesa",
  billing_approved: "Benestare approvato",
  billing_rejected: "Benestare rifiutato",
  opportunity_invited: "Invito opportunità",
  opportunity_awarded: "Esito opportunità",
  bid_submitted: "Nuova offerta ricevuta",
  onboarding_completed: "Onboarding completato",
  document_approved: "Documento approvato",
  document_rejected: "Documento respinto",
  document_expiry_warning: "Documento in scadenza",
};

function cleanText(input: string): string {
  return input
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      event_type,
      recipient_id,
      recipient_email,
      tenant_id,
      variables,
    } = payload;

    const rawVars =
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? (variables as Record<string, unknown>)
        : {};

    const vars: Record<string, string> = Object.fromEntries(
      Object.entries(rawVars).map(([key, val]) => [key, val == null ? "" : String(val)]),
    );

    // Backward-compatible aliases across old/new template placeholders
    if (!vars.company_name && vars.supplier_name) vars.company_name = vars.supplier_name;
    if (!vars.supplier_name && vars.company_name) vars.supplier_name = vars.company_name;
    if (!vars.bids_deadline && vars.deadline) vars.bids_deadline = vars.deadline;
    if (!vars.deadline && vars.bids_deadline) vars.deadline = vars.bids_deadline;
    if (!vars.contact_name && vars.full_name) vars.contact_name = vars.full_name;
    if (!vars.full_name && vars.contact_name) vars.full_name = vars.contact_name;

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

    // If no template, still insert in-app notification but skip email
    if (!template) {
      if (recipient_id) {
        const fallbackTitle = eventLabels[event_type] || `Notifica: ${event_type}`;
        const fallbackBody =
          vars.message ||
          vars.subject ||
          vars.opportunity_title ||
          vars.billing_code ||
          vars.order_code ||
          event_type;
        await supabase.from("notifications").insert({
          tenant_id,
          recipient_id,
          event_type,
          title: cleanText(fallbackTitle),
          body: cleanText(fallbackBody),
          is_read: false,
        });
      }
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "template_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Resolve recipient email
    let toEmail: string;
    let recipientName: string | null = null;

    if (recipient_email) {
      // Direct email provided (e.g. fixed procurement address)
      toEmail = recipient_email;
    } else if (recipient_id) {
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
      toEmail = profile.email;
      recipientName = profile.full_name;
    } else {
      return new Response(
        JSON.stringify({ error: "no_recipient" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Replace {{ variables }} in subject and html_body
    const replaceVars = (text: string) =>
      text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");

    const subject = cleanText(replaceVars(template.subject)) || eventLabels[event_type] || `Notifica: ${event_type}`;
    const html_body = cleanText(replaceVars(template.html_body));

    // 4. Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@vendorhub.it";
    let emailSent = false;

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: html_body,
        }),
      });

      emailSent = emailRes.ok;
      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error("Resend error:", errBody);
        // Still insert notification even if email fails
      }
    } else {
      console.error("RESEND_API_KEY not configured, skipping email send");
    }

    // 5. Insert notification (only if we have a recipient_id for in-app notification)
    if (recipient_id) {
      // Convert HTML to plain text for in-app notification body
      const plainBody = htmlToPlainText(html_body);

      const { error: notifErr } = await supabase.from("notifications").insert({
        tenant_id,
        recipient_id,
        event_type,
        title: subject,
        body: plainBody,
        is_read: false,
      });

      if (notifErr) {
        console.error("Notification insert error:", notifErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
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
