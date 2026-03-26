import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseRequestService } from "@/services/purchaseRequestService";
import { directPurchaseService } from "@/services/directPurchaseService";
import { toast } from "sonner";

// ─── Query hooks ────────────────────────────────────────────────

export function usePurchaseRequests(filters?: { status?: string; mine?: boolean; search?: string }) {
  return useQuery({
    queryKey: ["purchase-requests", filters],
    queryFn: () => purchaseRequestService.list(filters),
  });
}

export function usePurchaseRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-request", id],
    queryFn: () => purchaseRequestService.getById(id!),
    enabled: !!id,
  });
}

export function usePurchaseHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-request-history", id],
    queryFn: () => purchaseRequestService.getHistory(id!),
    enabled: !!id,
  });
}

export function useApprovalThreshold() {
  return useQuery({
    queryKey: ["purchase-approval-threshold"],
    queryFn: () => purchaseRequestService.getApprovalThreshold(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useDirectPurchases(filters?: { search?: string }) {
  return useQuery({
    queryKey: ["direct-purchases", filters],
    queryFn: () => directPurchaseService.list(filters),
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchaseRequestService.saveDraft,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      toast.success("Bozza salvata");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseRequestService.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Richiesta inviata");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      purchaseRequestService.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Richiesta approvata");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEscalateToFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseRequestService.escalateToFinance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Inoltrata a Finance");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      purchaseRequestService.approveFinance(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Approvata da Finance");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      purchaseRequestService.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Richiesta respinta");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetInPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseRequestService.setInPurchase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("In acquisto");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseRequestService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      toast.success("Richiesta annullata");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateDirectPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: directPurchaseService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["direct-purchases"] });
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["purchase-request"] });
      qc.invalidateQueries({ queryKey: ["purchase-request-history"] });
      toast.success("Acquisto diretto registrato");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
