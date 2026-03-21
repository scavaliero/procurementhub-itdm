import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/PageSkeleton";

export function SupplierRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.user_type !== "supplier") {
    return <Navigate to="/internal/dashboard" replace />;
  }

  return <>{children}</>;
}
