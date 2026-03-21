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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // ─── 1. Documents expiring within 30 days (still valid) → notify supplier ───
    const { data: expiringDocs, error: expErr } = await supabase
      .from("uploaded_documents")
      .select("id, supplier_id, document_type_id, expiry_date, tenant_id")
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("expiry_date", today)
      .lte("expiry_date", in30days);

    if (expErr) {
      console.error("Error fetching expiring docs:", expErr);
      throw expErr;
    }

    console.log(`Found ${expiringDocs?.length || 0} documents expiring within 30 days`);

    // Group by supplier to send one notification per supplier
    const expiringBySupplier = new Map<string, { count: number; tenantId: string }>();
    for (const doc of expiringDocs || []) {
      const existing = expiringBySupplier.get(doc.supplier_id);
      if (existing) {
        existing.count++;
      } else {
        expiringBySupplier.set(doc.supplier_id, { count: 1, tenantId: doc.tenant_id });
      }
    }

    // Send expiry warning notifications
    for (const [supplierId, { count, tenantId }] of expiringBySupplier) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("supplier_id", supplierId)
        .limit(1)
        .maybeSingle();

      if (!profile) continue;

      // Check if we already notified today (avoid spam)
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("recipient_id", profile.id)
        .eq("event_type", "document_expiry_warning")
        .gte("created_at", `${today}T00:00:00`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Send notification
      await supabase.functions.invoke("send-notification", {
        body: {
          event_type: "document_expiry_warning",
          recipient_id: profile.id,
          tenant_id: tenantId,
          variables: {
            count: String(count),
            full_name: profile.full_name,
          },
        },
      });

      console.log(`Sent expiry warning to supplier ${supplierId} (${count} docs)`);
    }

    // ─── 2. Expired documents → set supplier status back to pending ───
    const { data: expiredDocs, error: expiredErr } = await supabase
      .from("uploaded_documents")
      .select("id, supplier_id, document_type_id, tenant_id")
      .eq("status", "approved")
      .is("deleted_at", null)
      .lt("expiry_date", today);

    if (expiredErr) {
      console.error("Error fetching expired docs:", expiredErr);
      throw expiredErr;
    }

    console.log(`Found ${expiredDocs?.length || 0} expired documents`);

    // Mark expired documents
    const expiredIds = (expiredDocs || []).map((d) => d.id);
    if (expiredIds.length > 0) {
      // We can't batch update with .in() and set status, so update one by one
      // Actually we can - just update all matching IDs
      // But first, let's only process mandatory docs
    }

    // Get unique supplier IDs with expired docs
    const suppliersWithExpired = new Set<string>();
    const expiredSupplierTenant = new Map<string, string>();
    for (const doc of expiredDocs || []) {
      // Check if this is a mandatory document
      const { data: docType } = await supabase
        .from("document_types")
        .select("is_mandatory")
        .eq("id", doc.document_type_id)
        .maybeSingle();

      if (docType?.is_mandatory) {
        suppliersWithExpired.add(doc.supplier_id);
        expiredSupplierTenant.set(doc.supplier_id, doc.tenant_id);
      }
    }

    // For each supplier with expired mandatory docs, revert to pending
    for (const supplierId of suppliersWithExpired) {
      const tenantId = expiredSupplierTenant.get(supplierId)!;

      // Check current status - only revert if currently accredited
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("status")
        .eq("id", supplierId)
        .maybeSingle();

      if (!supplier || supplier.status !== "accredited") continue;

      // Update supplier status to pending
      const { error: updErr } = await supabase
        .from("suppliers")
        .update({ status: "pending" })
        .eq("id", supplierId);

      if (updErr) {
        console.error(`Error updating supplier ${supplierId}:`, updErr);
        continue;
      }

      // Insert status history
      await supabase.from("supplier_status_history").insert({
        supplier_id: supplierId,
        from_status: "accredited",
        to_status: "pending",
        reason: "Documenti obbligatori scaduti",
      });

      // Audit log
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        entity_type: "suppliers",
        entity_id: supplierId,
        event_type: "status_change",
        old_state: { status: "accredited" },
        new_state: { status: "pending", reason: "Documenti obbligatori scaduti" },
      });

      // Notify supplier
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("supplier_id", supplierId)
        .limit(1)
        .maybeSingle();

      if (profile) {
        await supabase.functions.invoke("send-notification", {
          body: {
            event_type: "supplier_suspended_expired_docs",
            recipient_id: profile.id,
            tenant_id: tenantId,
            variables: {
              full_name: profile.full_name,
            },
          },
        });
      }

      console.log(`Supplier ${supplierId} reverted to pending (expired docs)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expiring_warnings_sent: expiringBySupplier.size,
        suppliers_reverted: suppliersWithExpired.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-document-expiry error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
