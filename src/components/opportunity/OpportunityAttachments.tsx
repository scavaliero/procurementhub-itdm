import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { opportunityService } from "@/services/opportunityService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Download, Loader2 } from "lucide-react";

const ATTACHMENT_TYPES = [
  { key: "specifiche_tecniche", label: "Specifiche tecniche" },
  { key: "condizioni_contrattuali", label: "Condizioni contrattuali" },
  { key: "requisiti_partecipazione", label: "Requisiti di partecipazione" },
] as const;

interface Props {
  opportunityId: string;
  readOnly?: boolean;
}

export default function OpportunityAttachments({ opportunityId, readOnly = false }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documenti allegati</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ATTACHMENT_TYPES.map((type) => (
          <AttachmentSection
            key={type.key}
            opportunityId={opportunityId}
            attachmentType={type.key}
            label={type.label}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AttachmentSection({
  opportunityId,
  attachmentType,
  label,
  readOnly,
}: {
  opportunityId: string;
  attachmentType: string;
  label: string;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const qk = ["opp-attachments", opportunityId, attachmentType];

  const { data: files = [] } = useQuery({
    queryKey: qk,
    queryFn: () => opportunityService.listTypedAttachments(opportunityId, attachmentType),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) => opportunityService.deleteAttachment(path),
    onMutate: async (path: string) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData(qk);
      const fileName = path.split("/").pop();
      qc.setQueryData(qk, (old: any[] | undefined) =>
        (old ?? []).filter((f: any) => f.name !== fileName)
      );
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success("File eliminato");
    },
    onError: (_err, _path, context) => {
      if (context?.prev) qc.setQueryData(qk, context.prev);
      toast.error("Errore nell'eliminazione del file");
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await opportunityService.uploadAttachment(opportunityId, file, attachmentType);
      qc.invalidateQueries({ queryKey: qk });
      toast.success(`${label} caricato`);
    } catch {
      toast.error("Errore nel caricamento");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (fileName: string) => {
    const path = `${opportunityId}/${attachmentType}/${fileName}`;
    try {
      const url = await opportunityService.getAttachmentUrl(path);
      window.open(url, "_blank");
    } catch {
      toast.error("Errore nel download");
    }
  };

  // In read-only mode, hide section if no files
  if (readOnly && files.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          {files.length > 0 && (
            <Badge variant="secondary" className="text-xs">{files.length}</Badge>
          )}
        </div>
        {!readOnly && (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
              disabled={uploading}
            />
            <Button variant="outline" size="sm" asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                Carica
              </span>
            </Button>
          </label>
        )}
      </div>

      {files.length === 0 && !readOnly && (
        <p className="text-xs text-muted-foreground pl-6">Nessun file caricato</p>
      )}

      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-2 pl-6 py-1 rounded hover:bg-muted/50 group">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{f.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDownload(f.name)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
              onClick={() => deleteMutation.mutate(`${opportunityId}/${attachmentType}/${f.name}`)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
