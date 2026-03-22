import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApprovalService } from "@/services/billingApprovalService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Trash2, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface BillingAttachmentsProps {
  billingId: string;
  canEdit: boolean;
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractOriginalName(name: string) {
  // Files are stored as {uuid}_{originalName}
  const idx = name.indexOf("_");
  return idx > 0 ? name.substring(idx + 1) : name;
}

export function BillingAttachments({ billingId, canEdit }: BillingAttachmentsProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["billing-attachments", billingId],
    queryFn: () => billingApprovalService.listAttachments(billingId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => billingApprovalService.uploadAttachment(billingId, file),
    onSuccess: () => {
      toast.success("Allegato caricato");
      qc.invalidateQueries({ queryKey: ["billing-attachments", billingId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) => billingApprovalService.deleteAttachment(path),
    onSuccess: () => {
      toast.success("Allegato eliminato");
      qc.invalidateQueries({ queryKey: ["billing-attachments", billingId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleDownload(path: string, name: string) {
    try {
      setDownloading(path);
      const url = await billingApprovalService.getAttachmentUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = extractOriginalName(name);
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      toast.error("Errore nel download: " + err.message);
    } finally {
      setDownloading(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Allegati</CardTitle>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {uploadMutation.isPending ? "Caricamento..." : "Carica"}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !attachments?.length ? (
          <p className="text-sm text-muted-foreground">Nessun allegato presente.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li
                key={att.path}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">
                    {extractOriginalName(att.name)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatFileSize(att.size)}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(att.path, att.name)}
                    disabled={downloading === att.path}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(att.path)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
