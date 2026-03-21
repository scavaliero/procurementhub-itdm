import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeNotifications } from "@/hooks/useRealtime";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { PageSkeleton } from "@/components/PageSkeleton";

export function InternalRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();

  useRealtimeNotifications();
  const { SessionTimeoutModal } = useSessionTimeout();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.user_type !== "internal") {
    return <Navigate to="/supplier/dashboard" replace />;
  }

  return (
    <>
      {children}
      <SessionTimeoutModal />
    </>
  );
}
