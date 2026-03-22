import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

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
import SupplierNotifications from "@/pages/supplier/Notifications";

import InternalLayout from "@/layouts/InternalLayout";
import InternalDashboard from "@/pages/internal/Dashboard";
import InternalVendors from "@/pages/internal/Vendors";
import InternalVendorDetail from "@/pages/internal/VendorDetail";
import InternalOpportunities from "@/pages/internal/Opportunities";
import InternalOpportunityNew from "@/pages/internal/OpportunityNew";
import InternalOpportunityDetail from "@/pages/internal/OpportunityDetail";
import InternalOpportunityEvaluation from "@/pages/internal/OpportunityEvaluation";
import InternalOrders from "@/pages/internal/Orders";
import InternalCreateOrder from "@/pages/internal/CreateOrder";
import InternalContractDetail from "@/pages/internal/ContractDetail";
import InternalBillingApprovals from "@/pages/internal/BillingApprovals";
import ConfigDocumentTypes from "@/pages/internal/ConfigDocumentTypes";
import ConfigCategories from "@/pages/internal/ConfigCategories";
import AdminRoles from "@/pages/internal/AdminRoles";
import AdminUsers from "@/pages/internal/AdminUsers";
import InternalNotifications from "@/pages/internal/Notifications";

const App = () => (
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
            <Route path="/supplier/notifications" element={<SupplierNotifications />} />
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
            <Route path="/internal/opportunities/:id/evaluation" element={<InternalOpportunityEvaluation />} />
            <Route path="/internal/opportunities/:id/create-order" element={<InternalCreateOrder />} />
            <Route path="/internal/orders" element={<InternalOrders />} />
            <Route path="/internal/contracts/:id" element={<InternalContractDetail />} />
            <Route path="/internal/billing-approvals" element={<InternalBillingApprovals />} />
            <Route path="/internal/notifications" element={<InternalNotifications />} />
            <Route path="/internal/config/document-types" element={<ConfigDocumentTypes />} />
            <Route path="/internal/config/categories" element={<ConfigCategories />} />
            <Route path="/internal/admin/roles" element={<AdminRoles />} />
            <Route path="/internal/admin/users" element={<AdminUsers />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
