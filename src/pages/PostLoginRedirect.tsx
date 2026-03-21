import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function PostLoginRedirect() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <PageSkeleton />;

  return profile.user_type === "supplier"
    ? <Navigate to="/supplier/dashboard" replace />
    : <Navigate to="/internal/dashboard" replace />;
}
