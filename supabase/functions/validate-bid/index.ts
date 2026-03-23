import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunity_id, supplier_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch opportunity
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, bids_deadline, status, category_id")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (oppErr) throw oppErr;
    if (!opp) {
      return jsonResponse({ valid: false, code: "OPP_NOT_FOUND", message: "Opportunità non trovata" });
    }

    // 2. RB-04: Check deadline
    if (opp.bids_deadline && new Date(opp.bids_deadline) < new Date()) {
      return jsonResponse({
        valid: false,
        code: "RB04",
        message: "Termine per la presentazione delle offerte scaduto",
        bids_deadline: opp.bids_deadline,
      });
    }

    // 3. RB-01: Check supplier category qualification
    if (opp.category_id) {
      const { data: supCat, error: scErr } = await supabase
        .from("supplier_categories")
        .select("status, valid_until")
        .eq("supplier_id", supplier_id)
        .eq("category_id", opp.category_id)
        .eq("status", "qualified")
        .maybeSingle();

      if (scErr) throw scErr;

      if (!supCat) {
        return jsonResponse({
          valid: false,
          code: "RB01",
          message: "Fornitore non qualificato per la categoria dell'opportunità",
          category_id: opp.category_id,
        });
      }

      if (supCat.valid_until && new Date(supCat.valid_until) < new Date()) {
        return jsonResponse({
          valid: false,
          code: "RB01_EXPIRED",
          message: "Qualifica categoria scaduta",
          category_id: opp.category_id,
          valid_until: supCat.valid_until,
        });
      }
    }

    // 4. RB-02: Check mandatory documents
    const { data: missingDocs, error: mdErr } = await supabase.rpc(
      "check_mandatory_docs",
      {
        p_supplier_id: supplier_id,
        p_category_id: opp.category_id,
      }
    );

    if (mdErr) throw mdErr;

    if (missingDocs && missingDocs.length > 0) {
      return jsonResponse({
        valid: false,
        code: "RB02",
        message: "Documenti obbligatori mancanti o non approvati",
        missing_documents: missingDocs,
      });
    }

    // 5. RB-05: Check budget max
    if (opp.budget_max) {
      const { data: bid } = await supabase
        .from("bids")
        .select("total_amount")
        .eq("opportunity_id", opportunity_id)
        .eq("supplier_id", supplier_id)
        .eq("status", "draft")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bid && bid.total_amount != null && Number(bid.total_amount) > Number(opp.budget_max)) {
        return jsonResponse({
          valid: false,
          code: "RB05",
          message: `L'importo dell'offerta (€ ${Number(bid.total_amount).toLocaleString("it-IT")}) supera il budget massimo (€ ${Number(opp.budget_max).toLocaleString("it-IT")})`,
          budget_max: opp.budget_max,
          bid_amount: bid.total_amount,
        });
      }
    }

    // 6. All checks passed
    return jsonResponse({ valid: true });
  } catch (err) {
    console.error("validate-bid error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
