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
    const { contract_id, new_amount } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch contract economic summary
    const { data: summary, error: sumErr } = await supabase
      .from("contract_economic_summary")
      .select(
        "residual_amount, current_authorized_amount, pending_approval_amount"
      )
      .eq("contract_id", contract_id)
      .maybeSingle();

    if (sumErr) throw sumErr;
    if (!summary) {
      return new Response(
        JSON.stringify({ valid: false, code: "CONTRACT_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const residualAmount = Number(summary.residual_amount);
    const authorizedAmount = Number(summary.current_authorized_amount);
    const pendingAmount = Number(summary.pending_approval_amount);
    const amount = Number(new_amount);

    // 2. RB-08: Check if new_amount exceeds residual
    if (amount > residualAmount) {
      return new Response(
        JSON.stringify({
          valid: false,
          code: "RB08",
          message: "Importo benestare supera il residuo contrattuale",
          residual_amount: residualAmount,
          authorized_amount: authorizedAmount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. OK — with optional warning about pending approvals
    const residualAfterPending = residualAmount - pendingAmount;
    const warning =
      amount > residualAfterPending
        ? "Attenzione: l'importo supera il residuo al netto dei benestare in attesa di approvazione"
        : null;

    return new Response(
      JSON.stringify({
        valid: true,
        residual_amount: residualAmount,
        warning,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-billing-limit error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
