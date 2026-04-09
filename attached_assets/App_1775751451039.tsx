import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountSwitcher } from "@/components/account-switcher";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Bell } from "lucide-react";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { NotificationBanner } from "@/components/notification-banner";
import ppdLogo from "@assets/PPD_Logo_1770133190386.png";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ChangePasswordPage from "@/pages/change-password";
import DashboardPage from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import CustomersPage from "@/pages/customers";
import InvoicesPage from "@/pages/invoices";
import BatchesPage from "@/pages/batches";
import TerminalsPage from "@/pages/terminals";
import DisputesPage from "@/pages/disputes";
import AchReturnsPage from "@/pages/ach-returns";
import DepositsPage from "@/pages/deposits";
import AllBatchesPage from "@/pages/all-batches";
import StatementsPage from "@/pages/statements";
import InventoryPage from "@/pages/inventory";
import InventoryTrackingPage from "@/pages/inventory-tracking";
import POSPage from "@/pages/pos";

import QuickPaymentPage from "@/pages/quick-payment";
import CreateInvoicePage from "@/pages/create-invoice";
import RecurringPage from "@/pages/recurring";
import RecurringPlansPage from "@/pages/recurring-plans";
import CustomerDetailPage from "@/pages/customer-detail";
import SalesAgentsPage from "@/pages/sales-agents";

import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminMerchantsPage from "@/pages/admin/merchants";
import AdminUsersPage from "@/pages/admin/users";
import AdminAuditPage from "@/pages/admin/audit";
import AdminEmailTemplatesPage from "@/pages/admin/email-templates";
import AdminMerchantBillingPage from "@/pages/admin/merchant-billing";
import AdminBillingSettingsPage from "@/pages/admin/billing-settings";
import AdminMerchantAgreementsPage from "@/pages/admin/merchant-agreements";
import AdminMerchantVaultPage from "@/pages/admin/merchant-vault";
import AdminTaxRatesPage from "@/pages/admin/tax-rates";

import TeamSettingsPage from "@/pages/settings/team";
import CredentialsSettingsPage from "@/pages/settings/credentials";
import BrandingSettingsPage from "@/pages/settings/branding";
import TaxSettingsPage from "@/pages/settings/tax";
import EmailTemplatesPage from "@/pages/settings/email-templates";
import AcceptedTendersPage from "@/pages/settings/accepted-tenders";
import PromoCodesPage from "@/pages/settings/promo-codes";
import AgreementFieldsPage from "@/pages/settings/agreement-fields";
import StoreFinancingPage from "@/pages/settings/store-financing";
import PaymentAdjustmentsPage from "@/pages/settings/payment-adjustments";
import AppsSettingsPage from "@/pages/settings/apps";
import NotificationsPage from "@/pages/settings/notifications";

import PayerDashboard from "@/pages/payer/dashboard";
import PayerInvoices from "@/pages/payer/invoices";
import PayerHistory from "@/pages/payer/history";
import PayerRecurring from "@/pages/payer/recurring";
import PayerPurchases from "@/pages/payer/purchases";
import PayerMethods from "@/pages/payer/methods";
import PayerSettings from "@/pages/payer/settings";
import PayerRegister from "@/pages/payer/register";
import PublicInvoicePayPage from "@/pages/public-invoice-pay";

import AgentDashboard from "@/pages/agent/dashboard";
import AgentInventory from "@/pages/agent/inventory";
import AgentStore from "@/pages/agent/store";
import AgentDocumentLibrary from "@/pages/agent/document-library";
import DocumentLibraryPage from "@/pages/document-library";
import AgreementsPage from "@/pages/agreements";
import SignedAgreementsPage from "@/pages/signed-agreements";
import FinancingTemplatesPage from "@/pages/financing-templates";
import AgentAgreementsPage from "@/pages/agent/agreements";
import AgentBilling from "@/pages/agent/billing";
import { AgentBillingGate } from "@/components/agent-billing-gate";
import PublicAgreementSignPage from "@/pages/public-agreement-sign";
import PayerStore from "@/pages/payer/store";
import OrdersPage from "@/pages/orders";
import MerchantAgreementPage from "@/pages/onboarding/merchant-agreement";
import MerchantPaymentPage from "@/pages/onboarding/merchant-payment";

function MerchantRouter() {
  const { tenant } = useAuth();
  const [location] = useLocation();

  const { data: agreementData } = useQuery({
    queryKey: ["/api/onboarding/agreement"],
    enabled: !!tenant,
  });

  const agreementSigned = tenant?.merchantAgreementSignedAt || agreementData?.signed;
  const needsAgreement = tenant && !agreementSigned;
  const isOnboardingPage = location.startsWith("/onboarding/");

  if (needsAgreement && !isOnboardingPage) {
    return <Redirect to="/onboarding/agreement" />;
  }

  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/quick-payment" component={QuickPaymentPage} />
      <Route path="/invoice" component={CreateInvoicePage} />
      <Route path="/invoice/:id" component={CreateInvoicePage} />
      <Route path="/transactions" component={TransactionsPage} />
      <Route path="/batches" component={BatchesPage} />

      <Route path="/customers" component={CustomersPage} />
      <Route path="/customers/:id" component={CustomerDetailPage} />
      <Route path="/sales-agents" component={SalesAgentsPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/recurring" component={RecurringPage} />
      <Route path="/recurring-plans" component={RecurringPlansPage} />
      <Route path="/terminals" component={TerminalsPage} />
      <Route path="/disputes" component={DisputesPage} />
      <Route path="/ach-returns" component={AchReturnsPage} />
      <Route path="/deposits" component={DepositsPage} />
      <Route path="/all-batches" component={AllBatchesPage} />
      <Route path="/statements" component={StatementsPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/inventory/tracking" component={InventoryTrackingPage} />
      <Route path="/pos" component={POSPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/document-library" component={DocumentLibraryPage} />
      <Route path="/agreements">{() => <AgreementsPage />}</Route>
      <Route path="/signed-agreements" component={SignedAgreementsPage} />
      <Route path="/financing-templates" component={FinancingTemplatesPage} />
      <Route path="/settings/team" component={TeamSettingsPage} />
      <Route path="/settings/credentials" component={CredentialsSettingsPage} />
      <Route path="/settings/branding" component={BrandingSettingsPage} />
      <Route path="/settings/tax" component={TaxSettingsPage} />
      <Route path="/settings/email-templates" component={EmailTemplatesPage} />
      <Route path="/settings/accepted-tenders" component={AcceptedTendersPage} />
      <Route path="/settings/promo-codes" component={PromoCodesPage} />
      <Route path="/settings/agreement-fields" component={AgreementFieldsPage} />
      <Route path="/settings/store-financing" component={StoreFinancingPage} />
      <Route path="/settings/payment-adjustments" component={PaymentAdjustmentsPage} />
      <Route path="/settings/apps" component={AppsSettingsPage} />
      <Route path="/settings/notifications" component={NotificationsPage} />
      <Route path="/onboarding/agreement" component={MerchantAgreementPage} />
      <Route path="/onboarding/payment" component={MerchantPaymentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/merchants" component={AdminMerchantsPage} />
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/audit" component={AdminAuditPage} />
      <Route path="/admin/email-templates" component={AdminEmailTemplatesPage} />
      <Route path="/admin/billing-settings" component={AdminBillingSettingsPage} />
      <Route path="/admin/merchant-billing" component={AdminMerchantBillingPage} />
      <Route path="/admin/merchant-agreements" component={AdminMerchantAgreementsPage} />
      <Route path="/admin/merchant-vault" component={AdminMerchantVaultPage} />
      <Route path="/admin/tax-rates" component={AdminTaxRatesPage} />
      <Route path="/">
        <Redirect to="/admin" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PayerRouter() {
  return (
    <Switch>
      <Route path="/payer" component={PayerDashboard} />
      <Route path="/payer/invoices" component={PayerInvoices} />
      <Route path="/payer/history" component={PayerHistory} />
      <Route path="/payer/recurring" component={PayerRecurring} />
      <Route path="/payer/purchases" component={PayerPurchases} />
      <Route path="/payer/methods" component={PayerMethods} />
      <Route path="/payer/store" component={PayerStore} />
      <Route path="/payer/settings" component={PayerSettings} />
      <Route path="/">
        <Redirect to="/payer" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function SalesAgentRouter() {
  return (
    <Switch>
      <Route path="/agent" component={AgentDashboard} />
      <Route path="/agent/customers" component={AgentDashboard} />
      <Route path="/agent/invoices" component={AgentDashboard} />
      <Route path="/agent/payments" component={AgentDashboard} />
      <Route path="/agent/recurring" component={AgentDashboard} />
      <Route path="/agent/inventory" component={AgentInventory} />
      <Route path="/agent/store" component={AgentStore} />
      <Route path="/agent/billing" component={AgentBilling} />
      <Route path="/agent/documents" component={AgentDocumentLibrary} />
      <Route path="/agent/agreements" component={AgentAgreementsPage} />
      <Route path="/">
        <Redirect to="/agent" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function NotificationBell() {
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000
  });
  const count = data?.count || 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => setLocation("/settings/notifications")}
      data-testid="button-notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" data-testid="badge-unread-count">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}

function AuthenticatedApp() {
  const { user, logout, isPlatformAdmin, isMerchantUser, isPayerUser, isSalesAgent, impersonation } = useAuth();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem"
  };

  const isImpersonating = impersonation?.active;
  const showNotificationBell = !isPlatformAdmin || isImpersonating;

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex flex-col h-screen w-full">
        {isImpersonating && impersonation.merchantName && (
          <ImpersonationBanner merchantName={impersonation.merchantName} />
        )}
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              <div className="flex items-center gap-2">
                <AccountSwitcher />
                {showNotificationBell && <NotificationBell />}
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>
            {showNotificationBell && <NotificationBanner />}
            <main className="flex-1 overflow-auto">
              {isPlatformAdmin && !isImpersonating ? (
                <AdminRouter />
              ) : isPayerUser ? (
                <PayerRouter />
              ) : isSalesAgent ? (
                <AgentBillingGate>
                  <SalesAgentRouter />
                </AgentBillingGate>
              ) : (
                <MerchantRouter />
              )}
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <img 
            src={ppdLogo} 
            alt="PPD Technology" 
            className="h-14 w-auto animate-pulse"
          />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (window.location.pathname.startsWith("/pay/invoice/")) {
    return (
      <Switch>
        <Route path="/pay/invoice/:token" component={PublicInvoicePayPage} />
      </Switch>
    );
  }

  if (window.location.pathname.startsWith("/sign/agreement/")) {
    return (
      <Switch>
        <Route path="/sign/agreement/:token" component={PublicAgreementSignPage} />
      </Switch>
    );
  }

  if (mustChangePassword) {
    return <ChangePasswordPage />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/payer/register" component={PayerRegister} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
