import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SupplierRoute } from "@/components/SupplierRoute";
import { InternalRoute } from "@/components/InternalRoute";

import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import PostLoginRedirect from "@/pages/PostLoginRedirect";
import NotFound from "@/pages/NotFound";
import AuthCallback from "@/pages/AuthCallback";

import SupplierLayout from "@/layouts/SupplierLayout";
import SupplierDashboard from "@/pages/supplier/Dashboard";
import SupplierOnboarding from "@/pages/supplier/Onboarding";
import SupplierDocuments from "@/pages/supplier/Documents";
import SupplierOpportunities from "@/pages/supplier/Opportunities";
import SupplierOpportunityDetail from "@/pages/supplier/OpportunityDetail";
import SupplierOrders from "@/pages/supplier/Orders";
import SupplierBillingApprovals from "@/pages/supplier/BillingApprovals";
import SupplierBillingApprovalDetail from "@/pages/supplier/BillingApprovalDetail";
import SupplierNotifications from "@/pages/supplier/Notifications";
import SupplierProfile from "@/pages/supplier/Profile";

import InternalLayout from "@/layouts/InternalLayout";
import InternalDashboard from "@/pages/internal/Dashboard";
import InternalVendors from "@/pages/internal/Vendors";
import InternalVendorDetail from "@/pages/internal/VendorDetail";
import InternalOpportunities from "@/pages/internal/Opportunities";
import InternalOpportunityNew from "@/pages/internal/OpportunityNew";
import InternalOpportunityDetail from "@/pages/internal/OpportunityDetail";
import InternalOpportunityEdit from "@/pages/internal/OpportunityEdit";
import InternalOpportunityEvaluation from "@/pages/internal/OpportunityEvaluation";
import InternalOrders from "@/pages/internal/Orders";
import InternalOrderDetail from "@/pages/internal/OrderDetail";
import InternalCreateOrder from "@/pages/internal/CreateOrder";
// ContractDetail is now integrated into OrderDetail
import InternalBillingApprovals from "@/pages/internal/BillingApprovals";
import InternalBillingApprovalDetail from "@/pages/internal/BillingApprovalDetail";
import ConfigDocumentTypes from "@/pages/internal/ConfigDocumentTypes";
import ConfigCategories from "@/pages/internal/ConfigCategories";
import AdminRoles from "@/pages/internal/AdminRoles";
import AdminUsers from "@/pages/internal/AdminUsers";
import AuditLogs from "@/pages/internal/AuditLogs";
import InternalNotifications from "@/pages/internal/Notifications";
import InternalProfile from "@/pages/internal/Profile";
import ChangePassword from "@/pages/ChangePassword";
import PurchaseRequestsPage from "@/pages/internal/purchasing/PurchaseRequestsPage";
import NewPurchaseRequestPage from "@/pages/internal/purchasing/NewPurchaseRequestPage";
import PurchaseRequestDetailPage from "@/pages/internal/purchasing/PurchaseRequestDetailPage";
import PurchasePanelPage from "@/pages/internal/purchasing/PurchasePanelPage";
import DirectPurchasesPage from "@/pages/internal/purchasing/DirectPurchasesPage";
import DirectPurchaseDetailPage from "@/pages/internal/purchasing/DirectPurchaseDetailPage";
import NewDirectPurchasePage from "@/pages/internal/purchasing/NewDirectPurchasePage";

const App = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Post-login redirect */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <PostLoginRedirect />
                  </ProtectedRoute>
                }
              />

              {/* Supplier routes */}
              <Route
                element={
                  <SupplierRoute>
                    <SupplierLayout />
                  </SupplierRoute>
                }
              >
                <Route path="/supplier/dashboard" element={<SupplierDashboard />} />
                <Route path="/supplier/onboarding" element={<SupplierOnboarding />} />
                <Route path="/supplier/documents" element={<SupplierDocuments />} />
                <Route path="/supplier/opportunities" element={<SupplierOpportunities />} />
                <Route path="/supplier/opportunities/:id" element={<SupplierOpportunityDetail />} />
                <Route path="/supplier/orders" element={<SupplierOrders />} />
                <Route path="/supplier/billing-approvals" element={<SupplierBillingApprovals />} />
                <Route path="/supplier/billing-approvals/:id" element={<SupplierBillingApprovalDetail />} />
                <Route path="/supplier/notifications" element={<SupplierNotifications />} />
                <Route path="/supplier/profile" element={<SupplierProfile />} />
                <Route path="/supplier/change-password" element={<ChangePassword />} />
              </Route>

              {/* Internal routes */}
              <Route
                element={
                  <InternalRoute>
                    <InternalLayout />
                  </InternalRoute>
                }
              >
                <Route path="/internal/dashboard" element={<InternalDashboard />} />
                <Route path="/internal/vendors" element={<InternalVendors />} />
                <Route path="/internal/vendors/:id" element={<InternalVendorDetail />} />
                <Route path="/internal/opportunities" element={<InternalOpportunities />} />
                <Route path="/internal/opportunities/new" element={<InternalOpportunityNew />} />
                <Route path="/internal/opportunities/:id" element={<InternalOpportunityDetail />} />
                <Route path="/internal/opportunities/:id/edit" element={<InternalOpportunityEdit />} />
                <Route path="/internal/opportunities/:id/evaluation" element={<InternalOpportunityEvaluation />} />
                <Route path="/internal/opportunities/:id/create-order" element={<InternalCreateOrder />} />
                <Route path="/internal/orders" element={<InternalOrders />} />
                <Route path="/internal/orders/:id" element={<InternalOrderDetail />} />
                {/* Contract detail is now part of order detail */}
                <Route path="/internal/billing-approvals" element={<InternalBillingApprovals />} />
                <Route path="/internal/billing-approvals/:id" element={<InternalBillingApprovalDetail />} />
                <Route path="/internal/notifications" element={<InternalNotifications />} />
                <Route path="/internal/config/document-types" element={<ConfigDocumentTypes />} />
                <Route path="/internal/config/categories" element={<ConfigCategories />} />
                <Route path="/internal/admin/roles" element={<AdminRoles />} />
                <Route path="/internal/admin/users" element={<AdminUsers />} />
                <Route path="/internal/admin/audit-logs" element={<AuditLogs />} />
                <Route path="/internal/profile" element={<InternalProfile />} />
                <Route path="/internal/change-password" element={<ChangePassword />} />
                {/* Purchasing module routes */}
                <Route path="/internal/purchasing/requests" element={<PurchaseRequestsPage />} />
                <Route path="/internal/purchasing/requests/new" element={<NewPurchaseRequestPage />} />
                <Route path="/internal/purchasing/requests/:id" element={<PurchaseRequestDetailPage />} />
                <Route path="/internal/purchasing/panel" element={<PurchasePanelPage />} />
                <Route path="/internal/purchasing/direct" element={<DirectPurchasesPage />} />
                <Route path="/internal/purchasing/direct/new/:reqId?" element={<NewDirectPurchasePage />} />
                <Route path="/internal/purchasing/direct/:id" element={<DirectPurchaseDetailPage />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
