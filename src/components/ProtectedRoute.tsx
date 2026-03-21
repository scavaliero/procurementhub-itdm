import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/PageSkeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
