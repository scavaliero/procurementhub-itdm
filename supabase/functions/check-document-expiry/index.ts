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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    if (expErr) throw expErr;

    console.log(`Found ${expiringDocs?.length || 0} documents expiring within 30 days`);

    // Group by supplier
    const expiringBySupplier = new Map<string, { count: number; tenantId: string }>();
    for (const doc of expiringDocs || []) {
      const existing = expiringBySupplier.get(doc.supplier_id);
      if (existing) existing.count++;
      else expiringBySupplier.set(doc.supplier_id, { count: 1, tenantId: doc.tenant_id });
    }

    // Send expiry warning notifications (non-blocking)
    for (const [supplierId, { count, tenantId }] of expiringBySupplier) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("supplier_id", supplierId)
          .limit(1)
          .maybeSingle();
        if (!profile) continue;

        // Avoid duplicate notification today
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", profile.id)
          .eq("event_type", "document_expiry_warning")
          .gte("created_at", `${today}T00:00:00`)
          .limit(1);
        if (existing && existing.length > 0) continue;

        await supabase.functions.invoke("send-notification", {
          body: {
            event_type: "document_expiry_warning",
            recipient_id: profile.id,
            tenant_id: tenantId,
            link_url: "/supplier/documents",
            related_entity_type: "uploaded_document",
            variables: { count: String(count), full_name: profile.full_name },
          },
        });
        console.log(`Sent expiry warning to supplier ${supplierId} (${count} docs)`);
      } catch (e) {
        console.error(`Warning notification error for ${supplierId}:`, e);
      }
    }

    // ─── 2. Expired mandatory documents → mark doc as expired, revert supplier to pending ───
    // Fetch expired approved docs joined with mandatory document_types in one query
    const { data: expiredDocs, error: expiredErr } = await supabase
      .from("uploaded_documents")
      .select("id, supplier_id, document_type_id, tenant_id, document_types!inner(is_mandatory)")
      .eq("status", "approved")
      .is("deleted_at", null)
      .lt("expiry_date", today)
      .eq("document_types.is_mandatory", true);

    if (expiredErr) throw expiredErr;

    console.log(`Found ${expiredDocs?.length || 0} expired mandatory documents`);

    // Mark all expired docs as 'expired'
    const expiredIds = (expiredDocs || []).map((d: any) => d.id);
    if (expiredIds.length > 0) {
      const { error: markErr } = await supabase
        .from("uploaded_documents")
        .update({ status: "expired" })
        .in("id", expiredIds);
      if (markErr) console.error("Error marking docs expired:", markErr);
    }

    // Collect unique suppliers to revert
    const suppliersToRevert = new Map<string, string>();
    for (const doc of expiredDocs || []) {
      if (!suppliersToRevert.has(doc.supplier_id)) {
        suppliersToRevert.set(doc.supplier_id, doc.tenant_id);
      }
    }

    let revertedCount = 0;

    for (const [supplierId, tenantId] of suppliersToRevert) {
      try {
        // Only revert if currently accredited or in_approval
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("status")
          .eq("id", supplierId)
          .maybeSingle();

        if (!supplier || !["accredited", "in_approval", "in_accreditation"].includes(supplier.status)) {
          continue;
        }

        const fromStatus = supplier.status;

        const { error: updErr } = await supabase
          .from("suppliers")
          .update({ status: "pending" })
          .eq("id", supplierId);

        if (updErr) {
          console.error(`Error updating supplier ${supplierId}:`, updErr);
          continue;
        }

        // Status history
        await supabase.from("supplier_status_history").insert({
          supplier_id: supplierId,
          from_status: fromStatus,
          to_status: "pending",
          reason: "Documenti obbligatori scaduti (automatico)",
        });

        // Audit log
        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          entity_type: "suppliers",
          entity_id: supplierId,
          event_type: "status_change",
          old_state: { status: fromStatus },
          new_state: { status: "pending", reason: "Documenti obbligatori scaduti" },
        });

        // Notify supplier (non-blocking)
        try {
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
                variables: { full_name: profile.full_name },
              },
            });
          }
        } catch (e) {
          console.error(`Notification error for ${supplierId}:`, e);
        }

        revertedCount++;
        console.log(`Supplier ${supplierId} reverted from ${fromStatus} to pending (expired docs)`);
      } catch (e) {
        console.error(`Error processing supplier ${supplierId}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_docs_marked: expiredIds.length,
        expiring_warnings_sent: expiringBySupplier.size,
        suppliers_reverted: revertedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("check-document-expiry error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
