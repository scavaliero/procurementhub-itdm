import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const eventLabels: Record<string, string> = {
  order_issued: "Nuovo ordine",
  order_accepted: "Ordine accettato",
  order_rejected: "Ordine rifiutato",
  billing_pending_approval: "Benestare in attesa di approvazione",
  billing_approved: "Benestare approvato",
  billing_rejected: "Benestare rifiutato",
  opportunity_invited: "Invito opportunità",
  opportunity_awarded: "Esito opportunità",
  bid_submitted: "Nuova offerta ricevuta",
  onboarding_completed: "Onboarding completato",
  document_approved: "Documento approvato",
  document_rejected: "Documento respinto",
  document_expiry_warning: "Documento in scadenza",
  supplier_enabled: "Account abilitato",
  supplier_suspended: "Account sospeso",
  pre_registration: "Richiesta di accesso",
  accreditation_approved: "Accreditamento approvato",
};

/**
 * User-friendly fallback labels for common template variables.
 * When a variable is missing, these provide readable placeholder text
 * instead of leaving orphan labels or blank spaces.
 */
const varFallbacks: Record<string, string> = {
  order_code: "codice non disponibile",
  billing_code: "codice non disponibile",
  opportunity_title: "opportunità",
  opportunity_code: "codice non disponibile",
  company_name: "fornitore",
  supplier_name: "fornitore",
  contact_name: "utente",
  full_name: "utente",
  amount: "importo da definire",
  total_amount: "importo da definire",
  subject: "–",
  deadline: "scadenza da definire",
  bids_deadline: "scadenza da definire",
  start_date: "data da definire",
  end_date: "data da definire",
  period_start: "data da definire",
  period_end: "data da definire",
  document_name: "documento",
  category_name: "categoria",
  reason: "–",
  review_notes: "nessuna nota",
};

/**
 * Replace {{variable}} placeholders with values or user-friendly fallbacks.
 * Lines containing only fallback text for cosmetic-only fields are removed
 * to avoid clutter (e.g. "Fornitore: fornitore").
 */
function renderTemplate(
  htmlTemplate: string,
  vars: Record<string, string>,
): string {
  const EMPTY = "\x00EMPTY\x00";
  const rendered = htmlTemplate.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match, key: string) => {
      const val = vars[key];
      if (val && val.trim()) return val;
      // Use friendly fallback if available, otherwise sentinel for removal
      return varFallbacks[key] || EMPTY;
    },
  );

  // Step 2: remove HTML elements that only contain the EMPTY sentinel
  // e.g. <strong>EMPTY</strong> → ""
  let cleaned = rendered.replace(
    /<(strong|em|b|i|span|a)\b[^>]*>\s*\x00EMPTY\x00\s*<\/\1>/gi,
    "",
  );

  // Step 3: remove lines/paragraphs that contain EMPTY
  // e.g. <p>Fornitore: </p> or <p>Importo: € </p>
  cleaned = cleaned.replace(
    /<(p|li|div)\b[^>]*>[^<]*\x00EMPTY\x00[^<]*<\/\1>/gi,
    "",
  );

  // Step 4: remove any remaining sentinels
  cleaned = cleaned.replace(/\x00EMPTY\x00/g, "");

  // Step 5: collapse multiple empty paragraphs and whitespace
  cleaned = cleaned
    .replace(/<(p|div)\b[^>]*>\s*<\/\1>/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return cleaned;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(h[1-6])\s*>/gi, "\n\n")
    .replace(/<\/\s*(p|div|tr)\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ")
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
      link_url,
      related_entity_id,
      related_entity_type,
    } = payload;

    const rawVars =
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? (variables as Record<string, unknown>)
        : {};

    const vars: Record<string, string> = Object.fromEntries(
      Object.entries(rawVars).map(([key, val]) => [
        key,
        val == null ? "" : String(val),
      ]),
    );

    // Backward-compatible aliases
    if (!vars.company_name && vars.supplier_name)
      vars.company_name = vars.supplier_name;
    if (!vars.supplier_name && vars.company_name)
      vars.supplier_name = vars.company_name;
    if (!vars.bids_deadline && vars.deadline)
      vars.bids_deadline = vars.deadline;
    if (!vars.deadline && vars.bids_deadline)
      vars.deadline = vars.bids_deadline;
    if (!vars.contact_name && vars.full_name)
      vars.contact_name = vars.full_name;
    if (!vars.full_name && vars.contact_name)
      vars.full_name = vars.contact_name;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    // If no template, still insert in-app notification with fallback
    if (!template) {
      if (recipient_id) {
        const fallbackTitle =
          eventLabels[event_type] || `Notifica: ${event_type}`;
        const fallbackBody =
          vars.message ||
          vars.subject ||
          vars.opportunity_title ||
          vars.order_code ||
          vars.billing_code ||
          event_type;
        await supabase.from("notifications").insert({
          tenant_id,
          recipient_id,
          event_type,
          title: fallbackTitle,
          body: fallbackBody,
          link_url: link_url || null,
          related_entity_id: related_entity_id || null,
          related_entity_type: related_entity_type || null,
          is_read: false,
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          email_sent: false,
          reason: "template_not_found",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Resolve recipient email
    let toEmail: string | undefined;
    let recipientName: string | null = null;

    if (recipient_email) {
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
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      toEmail = profile.email;
      recipientName = profile.full_name;
    } else {
      return new Response(
        JSON.stringify({ error: "no_recipient" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Render subject and body from template
    const renderedSubject = renderTemplate(template.subject, vars);
    const subject =
      renderedSubject || eventLabels[event_type] || `Notifica: ${event_type}`;

    const renderedHtmlBody = renderTemplate(template.html_body, vars);

    // 4. Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@vendorhub.it";
    let emailSent = false;

    if (resendKey && toEmail) {
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
          html: renderedHtmlBody,
        }),
      });

      emailSent = emailRes.ok;
      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        console.error("Resend error:", errBody);
      }
    } else if (!resendKey) {
      console.error("RESEND_API_KEY not configured, skipping email send");
    }

    // 5. Insert in-app notification
    if (recipient_id) {
      const plainBody = htmlToPlainText(renderedHtmlBody);

      const { error: notifErr } = await supabase.from("notifications").insert({
        tenant_id,
        recipient_id,
        event_type,
        title: subject,
        body: plainBody,
        link_url: link_url || null,
        related_entity_id: related_entity_id || null,
        related_entity_type: related_entity_type || null,
        is_read: false,
      });

      if (notifErr) {
        console.error("Notification insert error:", notifErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
