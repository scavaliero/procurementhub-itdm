import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_approval: "In approvazione",
  issued: "Emesso",
  accepted: "Accettato",
  rejected: "Rifiutato",
  in_progress: "In corso",
  completed: "Completato",
};

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-teal-100 text-teal-700",
  pending_approval: "bg-amber-100 text-amber-700",
};

export default function SupplierOrders() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["supplier-orders"],
    queryFn: () => orderService.listForSupplier(profile?.supplier_id ?? ""),
    enabled: !!profile?.supplier_id,
  });

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => orderService.acceptOrder(orderId, profile!.tenant_id),
    onSuccess: () => {
      toast.success("Ordine accettato");
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      orderService.rejectOrder(orderId, profile!.tenant_id, reason),
    onSuccess: () => {
      toast.success("Ordine rifiutato");
      qc.invalidateQueries({ queryKey: ["supplier-orders"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

  if (isLoading) {
    return <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ordini ricevuti</h1>

      {orders.length === 0 ? (
        <EmptyState title="Nessun ordine" description="Non hai ancora ricevuto ordini." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Importo (€)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{o.subject}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[o.status] ?? ""}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      € {Number(o.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.start_date && o.end_date
                        ? `${format(new Date(o.start_date), "dd/MM/yy")} – ${format(new Date(o.end_date), "dd/MM/yy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {o.status === "issued" ? (
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600"
                            onClick={() => acceptMutation.mutate(o.id)}
                            disabled={acceptMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" /> Accetta
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRejectDialog(o.id)}
                          >
                            <X className="h-4 w-4 mr-1" /> Rifiuta
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rifiuta ordine</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivazione *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Inserisci la motivazione del rifiuto..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectDialog) {
                  rejectMutation.mutate({ orderId: rejectDialog, reason: rejectReason });
                }
              }}
            >
              Conferma rifiuto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
