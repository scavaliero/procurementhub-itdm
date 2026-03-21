import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function SupplierDashboard() {
  return (
    <ErrorBoundary>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Dashboard Fornitore</h1>
        <p className="text-muted-foreground">Benvenuto nel portale fornitori VendorHub.</p>
      </div>
    </ErrorBoundary>
  );
}
