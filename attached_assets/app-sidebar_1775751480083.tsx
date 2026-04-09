import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import ppdLogoPath from "@assets/PPD_Logo_1770916221642.png";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  FileText,
  Package,
  Terminal,
  AlertTriangle,
  Settings,
  Building2,
  Activity,
  History,
  ChevronDown,
  Shield,
  Boxes,
  ShoppingCart,
  Percent,
  Zap,
  Lock,
  RefreshCw,
  ClipboardList,
  UserCheck,
  Mail,
  Wallet,
  BanknoteIcon,
  BarChart3,
  Landmark,
  FileBarChart,
  Store,
  FolderOpen,
  FileSignature,
  ClipboardCheck,
  Tag,
  TextCursorInput,
  Receipt,
  AppWindow,
  Bell,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import type { TenantMerchant } from "@shared/schema";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  capability?: keyof TenantMerchant;
}

const paymentsSubMenuItems: MenuItem[] = [
  { title: "Quick Payment", url: "/quick-payment", icon: Zap },
  { title: "Create Invoice", url: "/invoice", icon: FileText },
  { title: "Recurring", url: "/recurring", icon: RefreshCw },
];

const accountsSubMenuItems: MenuItem[] = [
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Sales Agents", url: "/sales-agents", icon: UserCheck },
];

const reportsSubMenuItems: MenuItem[] = [
  { title: "Transactions", url: "/transactions", icon: CreditCard },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Batches", url: "/batches", icon: Activity },
  { title: "ACH Returns", url: "/ach-returns", icon: BanknoteIcon },
  { title: "Disputes", url: "/disputes", icon: AlertTriangle },
];

const reportAccountSubMenuItems: MenuItem[] = [
  { title: "Statements", url: "/statements", icon: FileBarChart },
  { title: "Funding", url: "/deposits", icon: Landmark },
  { title: "All Batches", url: "/all-batches", icon: Activity },
];

const inventoryManagerSubMenuItems: MenuItem[] = [
  { title: "Inventory", url: "/inventory", icon: Boxes, capability: "inventoryLiteEnabled" },
  { title: "Inventory Tracking", url: "/inventory/tracking", icon: ClipboardList, capability: "inventoryLiteEnabled" },
  { title: "Recurring Plans", url: "/recurring-plans", icon: ClipboardList },
];

const allMerchantMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "POS", url: "/pos", icon: ShoppingCart, capability: "posEnabled" },
  { title: "Shop Orders", url: "/orders", icon: Package, capability: "onlineStoreEnabled" },
];

function getMerchantMenuItems(tenant: TenantMerchant | null): MenuItem[] {
  if (!tenant) return allMerchantMenuItems.filter(item => !item.capability);
  return allMerchantMenuItems.filter(item => {
    if (!item.capability) return true;
    return tenant[item.capability] === true;
  });
}

const adminMenuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Merchants", url: "/admin/merchants", icon: Building2 },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Email Templates", url: "/admin/email-templates", icon: Mail },
  { title: "Billing Settings", url: "/admin/billing-settings", icon: CreditCard },
  { title: "Merchant Billing", url: "/admin/merchant-billing", icon: Receipt },
  { title: "Merchant Agreements", url: "/admin/merchant-agreements", icon: FileSignature },
  { title: "Billing Methods", url: "/admin/merchant-vault", icon: Wallet },
  { title: "Tax Rates", url: "/admin/tax-rates", icon: Percent },
  { title: "Audit Logs", url: "/admin/audit", icon: History }
];

const payerMenuItems = [
  { title: "Dashboard", url: "/payer", icon: LayoutDashboard },
  { title: "Store", url: "/payer/store", icon: Store },
  { title: "My Invoices", url: "/payer/invoices", icon: FileText },
  { title: "Payment History", url: "/payer/history", icon: History },
  { title: "Recurring Payments", url: "/payer/recurring", icon: RefreshCw },
  { title: "My Purchases", url: "/payer/purchases", icon: Package },
  { title: "Payment Methods", url: "/payer/methods", icon: CreditCard },
  { title: "Account Settings", url: "/payer/settings", icon: Settings }
];

const salesAgentMenuItems = [
  { title: "Dashboard", url: "/agent", icon: LayoutDashboard },
  { title: "Store", url: "/agent/store", icon: Store },
  { title: "Customers", url: "/agent/customers", icon: Users },
  { title: "Invoices", url: "/agent/invoices", icon: FileText },
  { title: "Payments", url: "/agent/payments", icon: CreditCard },
  { title: "Recurring", url: "/agent/recurring", icon: RefreshCw },
  { title: "Billing & Liability", url: "/agent/billing", icon: CreditCard },
  { title: "Inventory Tracking", url: "/agent/inventory", icon: Boxes },
  { title: "Document Library", url: "/agent/documents", icon: FolderOpen },
  { title: "E-Sign Agreements", url: "/agent/agreements", icon: FileSignature },
];

type MobileSection = "payments" | "customers" | "inventory" | "reports" | "tools" | "settings" | null;

function getInitialMobileSection(location: string): MobileSection {
  if (["/quick-payment", "/invoice", "/recurring"].includes(location)) return "payments";
  if (location.startsWith("/customers") || location.startsWith("/sales-agents")) return "customers";
  if (location.startsWith("/inventory") || location === "/recurring-plans") return "inventory";
  if (["/transactions", "/invoices", "/batches", "/ach-returns", "/disputes", "/statements", "/deposits", "/all-batches"].includes(location)) return "reports";
  if (location === "/document-library" || location === "/agreements" || location === "/signed-agreements" || location === "/financing-templates") return "tools";
  if (location.startsWith("/settings") || location === "/terminals") return "settings";
  return null;
}

interface MobileMerchantNavProps {
  location: string;
  tenant: TenantMerchant | null;
  merchantMenuItems: MenuItem[];
  isPlatformAdmin: boolean;
  setMobileOpen?: (open: boolean) => void;
}

function MobileMerchantNav({ location, tenant, merchantMenuItems, isPlatformAdmin }: MobileMerchantNavProps) {
  const [openSection, setOpenSection] = useState<MobileSection>(() => getInitialMobileSection(location));

  useEffect(() => {
    const section = getInitialMobileSection(location);
    if (section) setOpenSection(section);
  }, [location]);

  const toggle = (section: MobileSection) => {
    setOpenSection(prev => prev === section ? null : section);
  };

  const isActive = (url: string) => location === url || location.startsWith(url + "/");

  const MobileNavItem = ({ item }: { item: MenuItem }) => (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        className="h-10"
        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const MobileSectionTrigger = ({
    section,
    icon: Icon,
    label,
    hasActive,
  }: { section: MobileSection; icon: any; label: string; hasActive?: boolean }) => (
    <CollapsibleTrigger asChild>
      <SidebarMenuButton
        className={`h-10 cursor-pointer font-medium ${hasActive ? "text-primary" : ""}`}
        data-testid={`nav-mobile-section-${section}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${hasActive ? "text-primary" : ""}`} />
        <span>{label}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${openSection === section ? "rotate-180" : ""}`} />
      </SidebarMenuButton>
    </CollapsibleTrigger>
  );

  const filteredInventoryItems = inventoryManagerSubMenuItems.filter(item => {
    if (!item.capability) return true;
    if (!tenant) return false;
    return tenant[item.capability] === true;
  });

  const hasActivePayments = ["/quick-payment", "/invoice", "/recurring"].includes(location);
  const hasActiveCustomers = location.startsWith("/customers") || location.startsWith("/sales-agents");
  const hasActiveInventory = location.startsWith("/inventory") || location === "/recurring-plans";
  const hasActiveReports = ["/transactions", "/invoices", "/batches", "/ach-returns", "/disputes", "/statements", "/deposits", "/all-batches"].some(u => isActive(u));
  const hasActiveTools = ["/document-library", "/agreements", "/signed-agreements", "/financing-templates"].some(u => isActive(u));
  const hasActiveSettings = location.startsWith("/settings") || location === "/terminals";

  return (
    <SidebarMenu>
      {/* ── Top-level always-visible items ── */}
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={location === "/"} className="h-10" data-testid="nav-dashboard">
          <Link href="/">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Dashboard</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {merchantMenuItems.filter(item => item.url !== "/").map(item => (
        <MobileNavItem key={item.url} item={item} />
      ))}

      {/* ── Payments ── */}
      <Collapsible open={openSection === "payments"} onOpenChange={() => toggle("payments")}>
        <SidebarMenuItem>
          <MobileSectionTrigger section="payments" icon={CreditCard} label="Payments" hasActive={hasActivePayments} />
          <CollapsibleContent>
            <SidebarMenu className="pl-4 mt-0.5 mb-1">
              {paymentsSubMenuItems.map(item => <MobileNavItem key={item.url} item={item} />)}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      {/* ── Customers & Accounts ── */}
      <Collapsible open={openSection === "customers"} onOpenChange={() => toggle("customers")}>
        <SidebarMenuItem>
          <MobileSectionTrigger section="customers" icon={Users} label="Customers" hasActive={hasActiveCustomers} />
          <CollapsibleContent>
            <SidebarMenu className="pl-4 mt-0.5 mb-1">
              {accountsSubMenuItems.map(item => <MobileNavItem key={item.url} item={item} />)}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      {/* ── Inventory ── */}
      {filteredInventoryItems.length > 0 && (
        <Collapsible open={openSection === "inventory"} onOpenChange={() => toggle("inventory")}>
          <SidebarMenuItem>
            <MobileSectionTrigger section="inventory" icon={Boxes} label="Inventory" hasActive={hasActiveInventory} />
            <CollapsibleContent>
              <SidebarMenu className="pl-4 mt-0.5 mb-1">
                {filteredInventoryItems.map(item => <MobileNavItem key={item.url} item={item} />)}
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      )}

      {/* ── Reports ── */}
      <Collapsible open={openSection === "reports"} onOpenChange={() => toggle("reports")}>
        <SidebarMenuItem>
          <MobileSectionTrigger section="reports" icon={BarChart3} label="Reports" hasActive={hasActiveReports} />
          <CollapsibleContent>
            <SidebarMenu className="pl-4 mt-0.5 mb-1">
              {reportsSubMenuItems.map(item => <MobileNavItem key={item.url} item={item} />)}
              {reportAccountSubMenuItems.map(item => <MobileNavItem key={item.url} item={item} />)}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      {/* ── Tools ── */}
      <Collapsible open={openSection === "tools"} onOpenChange={() => toggle("tools")}>
        <SidebarMenuItem>
          <MobileSectionTrigger section="tools" icon={FolderOpen} label="Tools" hasActive={hasActiveTools} />
          <CollapsibleContent>
            <SidebarMenu className="pl-4 mt-0.5 mb-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/document-library"} className="h-10" data-testid="nav-document-library">
                  <Link href="/document-library">
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span>Document Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {tenant?.agreementsEnabled && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/agreements"} className="h-10" data-testid="nav-agreements">
                      <Link href="/agreements">
                        <FileSignature className="h-4 w-4 shrink-0" />
                        <span>E-Sign Agreements</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/signed-agreements"} className="h-10" data-testid="nav-signed-agreements">
                      <Link href="/signed-agreements">
                        <ClipboardCheck className="h-4 w-4 shrink-0" />
                        <span>Signed Agreements</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/financing-templates"} className="h-10" data-testid="nav-financing-templates">
                      <Link href="/financing-templates">
                        <BanknoteIcon className="h-4 w-4 shrink-0" />
                        <span>Financing Templates</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      {/* ── Visual separator before config ── */}
      <div className="mx-3 my-2 border-t border-sidebar-border" />

      {/* ── Configuration (low-frequency) ── */}
      <Collapsible open={openSection === "settings"} onOpenChange={() => toggle("settings")}>
        <SidebarMenuItem>
          <MobileSectionTrigger section="settings" icon={Settings} label="Configuration" hasActive={hasActiveSettings} />
          <CollapsibleContent>
            <SidebarMenu className="pl-4 mt-0.5 mb-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/apps"} className="h-10" data-testid="nav-settings-apps">
                  <Link href="/settings/apps"><AppWindow className="h-4 w-4 shrink-0" /><span>Apps</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/notifications"} className="h-10" data-testid="nav-settings-notifications">
                  <Link href="/settings/notifications"><Bell className="h-4 w-4 shrink-0" /><span>Notifications</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/team"} className="h-10" data-testid="nav-settings-team">
                  <Link href="/settings/team"><Users className="h-4 w-4 shrink-0" /><span>Team & Users</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings/credentials"} className="h-10" data-testid="nav-settings-credentials">
                    <Link href="/settings/credentials"><Shield className="h-4 w-4 shrink-0" /><span>API Credentials</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/branding"} className="h-10" data-testid="nav-settings-branding">
                  <Link href="/settings/branding"><Building2 className="h-4 w-4 shrink-0" /><span>Branding</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/tax"} className="h-10" data-testid="nav-settings-tax">
                  <Link href="/settings/tax"><Percent className="h-4 w-4 shrink-0" /><span>Tax Settings</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/email-templates"} className="h-10" data-testid="nav-settings-email-templates">
                  <Link href="/settings/email-templates"><Mail className="h-4 w-4 shrink-0" /><span>Email Templates</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {tenant?.onlineStoreEnabled && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings/promo-codes"} className="h-10" data-testid="nav-settings-promo-codes">
                    <Link href="/settings/promo-codes"><Tag className="h-4 w-4 shrink-0" /><span>Promo Codes</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {tenant?.agreementsEnabled && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings/agreement-fields"} className="h-10" data-testid="nav-settings-agreement-fields">
                    <Link href="/settings/agreement-fields"><TextCursorInput className="h-4 w-4 shrink-0" /><span>Agreement Fields</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/accepted-tenders"} className="h-10" data-testid="nav-settings-accepted-tenders">
                  <Link href="/settings/accepted-tenders"><Wallet className="h-4 w-4 shrink-0" /><span>Accepted Tenders</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings/payment-adjustments"} className="h-10" data-testid="nav-settings-payment-adjustments">
                  <Link href="/settings/payment-adjustments"><Percent className="h-4 w-4 shrink-0" /><span>Payment Pricing</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {tenant?.onlineStoreEnabled && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/settings/store-financing"} className="h-10" data-testid="nav-settings-store-financing">
                    <Link href="/settings/store-financing"><BanknoteIcon className="h-4 w-4 shrink-0" /><span>Store Financing</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {(!tenant || tenant.terminalApiEnabled) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/terminals"} className="h-10" data-testid="nav-terminals">
                    <Link href="/terminals"><Terminal className="h-4 w-4 shrink-0" /><span>Terminals</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile } = useSidebar();
  const { user, tenant, isPlatformAdmin, isMerchantUser, isPayerUser, isSalesAgent, impersonation } = useAuth();

  const isImpersonating = impersonation?.active;

  const merchantMenuItems = getMerchantMenuItems(tenant);
  const isPaymentRoute = paymentsSubMenuItems.some(item => location === item.url);
  const isAccountRoute = accountsSubMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));
  const isReportAccountRoute = reportAccountSubMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));
  const isReportRoute = reportsSubMenuItems.some(item => location === item.url || location.startsWith(item.url + "/")) || isReportAccountRoute;
  const isInventoryManagerRoute = inventoryManagerSubMenuItems.some(item => location === item.url || location.startsWith(item.url + "/"));
  const isEsignRoute = location === "/agreements" || location === "/signed-agreements" || location === "/financing-templates";
  const [paymentsOpen, setPaymentsOpen] = useState(isPaymentRoute);
  const [accountsOpen, setAccountsOpen] = useState(isAccountRoute);
  const [reportsOpen, setReportsOpen] = useState(isReportRoute);
  const [reportAccountOpen, setReportAccountOpen] = useState(isReportAccountRoute);
  const [inventoryManagerOpen, setInventoryManagerOpen] = useState(isInventoryManagerRoute);
  const [esignOpen, setEsignOpen] = useState(isEsignRoute);

  useEffect(() => { if (isPaymentRoute) setPaymentsOpen(true); }, [isPaymentRoute]);
  useEffect(() => { if (isAccountRoute) setAccountsOpen(true); }, [isAccountRoute]);
  useEffect(() => { if (isReportRoute) setReportsOpen(true); }, [isReportRoute]);
  useEffect(() => { if (isReportAccountRoute) setReportAccountOpen(true); }, [isReportAccountRoute]);
  useEffect(() => { if (isInventoryManagerRoute) setInventoryManagerOpen(true); }, [isInventoryManagerRoute]);
  useEffect(() => { if (isEsignRoute) setEsignOpen(true); }, [isEsignRoute]);

  const portalDisabled = (isSalesAgent && tenant?.agentPortalEnabled === false)
    || (isPayerUser && tenant?.customerPortalEnabled === false);

  const filterStoreItems = (items: typeof payerMenuItems) => {
    return items
      .filter(item => {
        if (item.url.includes("/store") && !tenant?.onlineStoreEnabled) return false;
        if (item.url.includes("/agreements") && !tenant?.agreementsEnabled) return false;
        return true;
      })
      .map(item => {
        if (item.url.includes("/store") && tenant?.name) {
          return { ...item, title: `Shop ${tenant.name}` };
        }
        return item;
      });
  };

  const menuItems = (isPlatformAdmin && !isImpersonating)
    ? adminMenuItems
    : isPayerUser
    ? (tenant?.customerPortalEnabled === false ? [] : filterStoreItems(payerMenuItems))
    : isSalesAgent
    ? (tenant?.agentPortalEnabled === false ? [] : filterStoreItems(salesAgentMenuItems))
    : merchantMenuItems;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.username?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name || "Logo"}
              className="h-9 w-auto object-contain"
            />
          ) : isPlatformAdmin && !isImpersonating ? (
            <img
              src={ppdLogoPath}
              alt="PPD Technology"
              className="h-9 w-auto object-contain"
              data-testid="img-ppd-logo"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0">
              {(tenant?.name || "MC").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate">{tenant?.name || "Merchant Center"}</span>
            <span className="text-xs text-muted-foreground">
              {isImpersonating ? "Merchant Center" : isPlatformAdmin ? "Admin Console" : isSalesAgent ? "Agent Center" : isPayerUser ? "Customer Center" : "Merchant Center"}
            </span>
            {(isMerchantUser || isImpersonating) && tenant?.accountMid && !isMobile && (
              <span className="text-xs text-muted-foreground" data-testid="text-sidebar-mid">
                MID: {tenant.accountMid}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isImpersonating ? "Merchant Portal" : isPlatformAdmin ? "Administration" : isPayerUser ? "My Account" : isSalesAgent ? "Sales Portal" : "Merchant Portal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {portalDisabled ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center" data-testid="portal-disabled-message">
                <Lock className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Portal Not Available</p>
                <p className="text-xs text-muted-foreground">
                  {isSalesAgent ? "The Agent Portal" : "The Customer Portal"} has been disabled by the merchant administrator.
                </p>
              </div>
            ) : (
              <SidebarMenu>
                {/* ── MOBILE MERCHANT: reorganized grouped nav ── */}
                {(isMerchantUser || isImpersonating) && isMobile ? (
                  <MobileMerchantNav
                    location={location}
                    tenant={tenant}
                    merchantMenuItems={merchantMenuItems}
                    isPlatformAdmin={isPlatformAdmin}
                  />
                ) : (isMerchantUser || isImpersonating) ? (
                  /* ── DESKTOP MERCHANT: original nav ── */
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/"} data-testid="nav-dashboard">
                        <Link href="/">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {merchantMenuItems.filter(item => item.url !== "/").map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    <Collapsible open={paymentsOpen || isPaymentRoute} onOpenChange={setPaymentsOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton data-testid="nav-payments-menu" className="cursor-pointer">
                            <CreditCard className="h-4 w-4" />
                            <span>Payments</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu className="pl-4 mt-1">
                            {paymentsSubMenuItems.map((item) => (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <Link href={item.url}>
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                    <Collapsible open={accountsOpen || isAccountRoute} onOpenChange={setAccountsOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton data-testid="nav-accounts-menu" className="cursor-pointer">
                            <Users className="h-4 w-4" />
                            <span>Accounts</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu className="pl-4 mt-1">
                            {accountsSubMenuItems.map((item) => (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={location === item.url || location.startsWith(item.url + "/")} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <Link href={item.url}>
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                    <Collapsible open={inventoryManagerOpen || isInventoryManagerRoute} onOpenChange={setInventoryManagerOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton data-testid="nav-inventory-manager-menu" className="cursor-pointer">
                            <Package className="h-4 w-4" />
                            <span>Inventory Manager</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu className="pl-4 mt-1">
                            {inventoryManagerSubMenuItems
                              .filter(item => {
                                if (!item.capability) return true;
                                if (!tenant) return false;
                                return tenant[item.capability] === true;
                              })
                              .map((item) => (
                                <SidebarMenuItem key={item.title}>
                                  <SidebarMenuButton asChild isActive={location === item.url || location.startsWith(item.url + "/")} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                    <Link href={item.url}>
                                      <item.icon className="h-4 w-4" />
                                      <span>{item.title}</span>
                                    </Link>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                    <Collapsible open={reportsOpen || isReportRoute} onOpenChange={setReportsOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton data-testid="nav-reports-menu" className="cursor-pointer">
                            <BarChart3 className="h-4 w-4" />
                            <span>Reports</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu className="pl-4 mt-1">
                            {reportsSubMenuItems.map((item) => (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                  <Link href={item.url}>
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                            <Collapsible open={reportAccountOpen || isReportAccountRoute} onOpenChange={setReportAccountOpen}>
                              <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuButton data-testid="nav-report-account-menu" className="cursor-pointer">
                                    <Wallet className="h-4 w-4" />
                                    <span>Account</span>
                                    <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenu className="pl-4 mt-1">
                                    {reportAccountSubMenuItems.map((item) => (
                                      <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                          <Link href={item.url}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                          </Link>
                                        </SidebarMenuButton>
                                      </SidebarMenuItem>
                                    ))}
                                  </SidebarMenu>
                                </CollapsibleContent>
                              </SidebarMenuItem>
                            </Collapsible>
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/document-library"} data-testid="nav-document-library">
                        <Link href="/document-library">
                          <FolderOpen className="h-4 w-4" />
                          <span>Document Library</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {tenant?.agreementsEnabled && (
                      <Collapsible open={esignOpen || isEsignRoute} onOpenChange={setEsignOpen}>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton data-testid="nav-esign-menu" className="cursor-pointer">
                              <FileSignature className="h-4 w-4" />
                              <span>E-Sign</span>
                              <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenu className="pl-4 mt-1">
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={location === "/agreements"} data-testid="nav-agreements">
                                  <Link href="/agreements">
                                    <FileSignature className="h-4 w-4" />
                                    <span>Agreements</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={location === "/signed-agreements"} data-testid="nav-signed-agreements">
                                  <Link href="/signed-agreements">
                                    <ClipboardCheck className="h-4 w-4" />
                                    <span>Signed Agreements</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={location === "/financing-templates"} data-testid="nav-financing-templates">
                                  <Link href="/financing-templates">
                                    <BanknoteIcon className="h-4 w-4" />
                                    <span>Financing Templates</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            </SidebarMenu>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )}
                  </>
                ) : (
                  /* ── Non-merchant users (payer, agent, admin) ── */
                  menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── DESKTOP Settings section (merchant only, not shown on mobile — mobile has it embedded above) ── */}
        {isMerchantUser && !isMobile && (
          <SidebarGroup>
            <Collapsible defaultOpen={location.startsWith("/settings") || location === "/terminals"}>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover-elevate rounded-md px-2 py-1.5">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/apps"} data-testid="nav-settings-apps">
                        <Link href="/settings/apps"><AppWindow className="h-4 w-4" /><span>Apps</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/notifications"} data-testid="nav-settings-notifications">
                        <Link href="/settings/notifications"><Bell className="h-4 w-4" /><span>Notifications</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/team"} data-testid="nav-settings-team">
                        <Link href="/settings/team"><Users className="h-4 w-4" /><span>Team & Users</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {isPlatformAdmin && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/settings/credentials"} data-testid="nav-settings-credentials">
                          <Link href="/settings/credentials"><Shield className="h-4 w-4" /><span>API Credentials</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/branding"} data-testid="nav-settings-branding">
                        <Link href="/settings/branding"><Building2 className="h-4 w-4" /><span>Branding</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/tax"} data-testid="nav-settings-tax">
                        <Link href="/settings/tax"><Percent className="h-4 w-4" /><span>Tax Settings</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/email-templates"} data-testid="nav-settings-email-templates">
                        <Link href="/settings/email-templates"><Mail className="h-4 w-4" /><span>Email Templates</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {tenant?.onlineStoreEnabled && (
                      <>
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild isActive={location === "/settings/promo-codes"} data-testid="nav-settings-promo-codes">
                            <Link href="/settings/promo-codes"><Tag className="h-4 w-4" /><span>Promo Codes</span></Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </>
                    )}
                    {tenant?.agreementsEnabled && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/settings/agreement-fields"} data-testid="nav-settings-agreement-fields">
                          <Link href="/settings/agreement-fields"><TextCursorInput className="h-4 w-4" /><span>Agreement Fields</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/accepted-tenders"} data-testid="nav-settings-accepted-tenders">
                        <Link href="/settings/accepted-tenders"><Wallet className="h-4 w-4" /><span>Accepted Tenders</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/settings/payment-adjustments"} data-testid="nav-settings-payment-adjustments">
                        <Link href="/settings/payment-adjustments"><Percent className="h-4 w-4" /><span>Payment Pricing</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {tenant?.onlineStoreEnabled && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/settings/store-financing"} data-testid="nav-settings-store-financing">
                          <Link href="/settings/store-financing"><BanknoteIcon className="h-4 w-4" /><span>Store Financing</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {(!tenant || tenant.terminalApiEnabled) && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/terminals"} data-testid="nav-terminals">
                          <Link href="/terminals"><Terminal className="h-4 w-4" /><span>Terminals</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${isMobile ? "p-3" : "p-4"}`}>
        <div className={`flex items-center ${isMobile ? "gap-2" : "gap-3"}`}>
          <Avatar className={isMobile ? "h-7 w-7" : "h-8 w-8"}>
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className={`font-medium truncate ${isMobile ? "text-xs" : "text-sm"}`}>
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.username}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.role?.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
