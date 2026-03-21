import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeNotifications } from "@/hooks/useRealtime";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { PageSkeleton } from "@/components/PageSkeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  // Realtime notifications subscription — active for all authenticated users
  useRealtimeNotifications();

  // Session timeout with inactivity warning
  const { SessionTimeoutModal } = useSessionTimeout();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      {children}
      <SessionTimeoutModal />
    </>
  );
}
