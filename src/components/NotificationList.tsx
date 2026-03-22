import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notificationService";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function NotificationList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "list", page, onlyUnread],
    queryFn: () =>
      notificationService.listPaginated(user!.id, page, pageSize, onlyUnread),
    enabled: !!user,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationService.markAllRead(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const notifications = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifiche</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyUnread ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => { setOnlyUnread(!onlyUnread); setPage(1); }}
          >
            <Filter className="h-3.5 w-3.5" />
            {onlyUnread ? "Non lette" : "Tutte"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Segna tutte come lette
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {onlyUnread ? "Nessuna notifica non letta" : "Nessuna notifica"}
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {notifications.map((n) => (
            <button
              key={n.id}
              className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3 ${
                !n.is_read ? "bg-primary/5" : ""
              }`}
              onClick={() => {
                if (!n.is_read) markReadMut.mutate(n.id);
                if (n.link_url) navigate(n.link_url);
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.is_read && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      Nuova
                    </Badge>
                  )}
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stripHtml(n.body)}
                  </p>
                )}
              </div>
              {n.created_at && (
                <span className="text-[11px] text-muted-foreground/60 shrink-0 mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                    locale: it,
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Precedente
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
          </Button>
        </div>
      )}
    </div>
  );
}
