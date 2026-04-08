import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { StoreProvider } from "@/contexts/store-context";
import { StationProvider } from "@/contexts/station-context";

import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminMerchants = lazy(() => import("@/pages/admin/merchants"));
const AdminMerchantDetail = lazy(() => import("@/pages/admin/merchant-detail"));
const AdminBilling = lazy(() => import("@/pages/admin/billing"));
const AdminAuditLog = lazy(() => import("@/pages/admin/audit-log"));
const AdminSupport = lazy(() => import("@/pages/admin/support"));
const AdminTransactions = lazy(() => import("@/pages/admin/transactions"));
const AdminAgreements = lazy(() => import("@/pages/admin/agreements"));
const AdminMxSettings = lazy(() => import("@/pages/admin/mx-settings"));
const AdminEmailTemplates = lazy(() => import("@/pages/admin/email-templates"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminNotificationHistory = lazy(() => import("@/pages/admin/notification-history"));

const MerchantDashboard = lazy(() => import("@/pages/merchant/dashboard"));
const MerchantPOS = lazy(() => import("@/pages/merchant/pos"));
const MerchantTickets = lazy(() => import("@/pages/merchant/tickets"));
const MerchantTicketDetail = lazy(() => import("@/pages/merchant/ticket-detail"));
const MerchantInventory = lazy(() => import("@/pages/merchant/inventory"));
const MerchantCustomers = lazy(() => import("@/pages/merchant/customers"));
const MerchantCustomerDetail = lazy(() => import("@/pages/merchant/customer-detail"));
const MerchantReports = lazy(() => import("@/pages/merchant/reports"));
const MerchantSettings = lazy(() => import("@/pages/merchant/settings"));
const MerchantOnboarding = lazy(() => import("@/pages/merchant/onboarding"));
const MerchantSales = lazy(() => import("@/pages/merchant/sales"));
const MerchantSaleDetail = lazy(() => import("@/pages/merchant/sale-detail"));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  if (user?.mustChangePassword && location !== "/change-password") {
    navigate("/change-password");
    return null;
  }

  return <>{children}</>;
}

function MerchantGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isMerchant, user } = useAuth();
  const [, navigate] = useLocation();

  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery<{
    agreementSigned: boolean;
    billingCardOnFile: boolean;
    onboardingComplete: boolean;
    billingLocked?: boolean;
    paymentStatus?: string;
    outstandingBalance?: string;
  }>({
    queryKey: ["/api/merchant/onboarding/status"],
    enabled: isAuthenticated && isMerchant,
  });

  const { data: settingsData } = useQuery<{ stores: Array<{ id: number; name: string; tenantId: number; isActive: boolean }> }>({
    queryKey: ["/api/merchant/settings"],
    enabled: isAuthenticated && isMerchant,
  });

  const needsOnboarding = isMerchant && onboardingStatus && !onboardingStatus.onboardingComplete;
  const billingLocked = isMerchant && onboardingStatus?.billingLocked;
  const needsPasswordChange = isMerchant && user?.mustChangePassword;
  const notAuthenticated = !isLoading && !isAuthenticated;
  const notMerchant = !isLoading && isAuthenticated && !isMerchant;

  useEffect(() => {
    if (notAuthenticated) navigate("/");
    else if (notMerchant) navigate("/admin");
    else if (needsPasswordChange) navigate("/change-password");
    else if (needsOnboarding) navigate("/app/onboarding");
    else if (billingLocked) navigate("/app/settings");
  }, [notAuthenticated, notMerchant, needsPasswordChange, needsOnboarding, billingLocked, navigate]);

  if (isLoading || (isMerchant && onboardingLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notAuthenticated || notMerchant || needsPasswordChange || needsOnboarding || billingLocked) return null;

  return (
    <StoreProvider stores={settingsData?.stores || []}>
      <StationProvider>
        {children}
      </StationProvider>
    </StoreProvider>
  );
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformAdmin } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    navigate(isPlatformAdmin ? "/admin" : "/app");
    return null;
  }

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/">
        <LoginGuard><LoginPage /></LoginGuard>
      </Route>
      <Route path="/forgot-password">
        <LoginGuard><ForgotPasswordPage /></LoginGuard>
      </Route>
      <Route path="/reset-password">
        <ResetPasswordPage />
      </Route>
      <Route path="/change-password">
        <AuthGuard><ChangePasswordPage /></AuthGuard>
      </Route>

      <Route path="/admin">
        <AuthGuard><AdminDashboard /></AuthGuard>
      </Route>
      <Route path="/admin/merchants">
        <AuthGuard><AdminMerchants /></AuthGuard>
      </Route>
      <Route path="/admin/merchants/:id">
        <AuthGuard><AdminMerchantDetail /></AuthGuard>
      </Route>
      <Route path="/admin/billing">
        <AuthGuard><AdminBilling /></AuthGuard>
      </Route>
      <Route path="/admin/audit-log">
        <AuthGuard><AdminAuditLog /></AuthGuard>
      </Route>
      <Route path="/admin/support">
        <AuthGuard><AdminSupport /></AuthGuard>
      </Route>
      <Route path="/admin/transactions">
        <AuthGuard><AdminTransactions /></AuthGuard>
      </Route>
      <Route path="/admin/agreements">
        <AuthGuard><AdminAgreements /></AuthGuard>
      </Route>
      <Route path="/admin/mx-settings">
        <AuthGuard><AdminMxSettings /></AuthGuard>
      </Route>
      <Route path="/admin/email">
        <AuthGuard><AdminEmailTemplates /></AuthGuard>
      </Route>
      <Route path="/admin/users">
        <AuthGuard><AdminUsers /></AuthGuard>
      </Route>
      <Route path="/admin/notification-history">
        <AuthGuard><AdminNotificationHistory /></AuthGuard>
      </Route>

      <Route path="/app/onboarding">
        <AuthGuard><MerchantOnboarding /></AuthGuard>
      </Route>
      <Route path="/app">
        <MerchantGuard><MerchantDashboard /></MerchantGuard>
      </Route>
      <Route path="/app/pos">
        <MerchantGuard><MerchantPOS /></MerchantGuard>
      </Route>
      <Route path="/app/tickets">
        <MerchantGuard><MerchantTickets /></MerchantGuard>
      </Route>
      <Route path="/app/tickets/:id">
        <MerchantGuard><MerchantTicketDetail /></MerchantGuard>
      </Route>
      <Route path="/app/sales">
        <MerchantGuard><MerchantSales /></MerchantGuard>
      </Route>
      <Route path="/app/sales/:id">
        <MerchantGuard><MerchantSaleDetail /></MerchantGuard>
      </Route>
      <Route path="/app/inventory">
        <MerchantGuard><MerchantInventory /></MerchantGuard>
      </Route>
      <Route path="/app/customers">
        <MerchantGuard><MerchantCustomers /></MerchantGuard>
      </Route>
      <Route path="/app/customers/:id">
        <MerchantGuard><MerchantCustomerDetail /></MerchantGuard>
      </Route>
      <Route path="/app/employees">
        <Redirect to="/app/settings?tab=employees" />
      </Route>
      <Route path="/app/reports">
        <MerchantGuard><MerchantReports /></MerchantGuard>
      </Route>
      <Route path="/app/settings">
        <AuthGuard><MerchantSettings /></AuthGuard>
      </Route>
      <Route path="/app/email-templates">
        <Redirect to="/app/settings?tab=templates" />
      </Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
