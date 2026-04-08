import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, ShoppingCart, Ticket, Package, Users, BarChart3, Settings, LogOut, ChevronDown, Menu, X, Store, Receipt, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStoreContext } from "@/contexts/store-context";
import { useStationContext } from "@/contexts/station-context";
import logoUrl from "@assets/repair_desk_logo_1773331678772.png";

const allNavItems = [
  { path: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { path: "/app/pos", label: "POS", icon: ShoppingCart, roles: null },
  { path: "/app/sales", label: "Sales", icon: Receipt, roles: null },
  { path: "/app/tickets", label: "Tickets", icon: Ticket, roles: null },
  { path: "/app/inventory", label: "Inventory", icon: Package, roles: ["owner", "manager"] },
  { path: "/app/customers", label: "Customers", icon: Users, roles: null },
  { path: "/app/reports", label: "Reports", icon: BarChart3, roles: ["owner", "manager"] },
  { path: "/app/settings", label: "Settings", icon: Settings, roles: ["owner", "manager"] },
];

function StoreSelector() {
  const { stores, selectedStoreId, setSelectedStoreId, isMultiStore } = useStoreContext();
  if (!isMultiStore) return null;

  const currentStore = stores.find(s => s.id === selectedStoreId);

  return (
    <div className="flex items-center gap-1.5 mr-2">
      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedStoreId ? String(selectedStoreId) : "all"} onValueChange={v => setSelectedStoreId(v === "all" ? null : parseInt(v))}>
        <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-store-context">
          <SelectValue placeholder={currentStore?.name || "All Stores"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="select-store-all">All Stores</SelectItem>
          {stores.map(s => (
            <SelectItem key={s.id} value={String(s.id)} data-testid={`select-store-${s.id}`}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StationSelector() {
  const { stations, selectedStationId, setSelectedStationId, isMultiStation } = useStationContext();
  if (!isMultiStation) return null;

  return (
    <div className="flex items-center gap-1.5 mr-2">
      <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedStationId ? String(selectedStationId) : ""} onValueChange={v => setSelectedStationId(parseInt(v))}>
        <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-station-context">
          <SelectValue placeholder="Select Station" />
        </SelectTrigger>
        <SelectContent>
          {stations.map(s => (
            <SelectItem key={s.id} value={String(s.id)} data-testid={`select-station-${s.id}`}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MerchantLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settingsData } = useQuery<{ settings?: { logoUrl?: string | null } }>({ queryKey: ["/api/merchant/settings"] });
  const merchantLogo = settingsData?.settings?.logoUrl || "";

  const roleLabel = user?.merchantRole ? user.merchantRole.charAt(0).toUpperCase() + user.merchantRole.slice(1) : "";
  const navItems = useMemo(() => {
    const role = user?.merchantRole || "";
    return allNavItems.filter(item => !item.roles || item.roles.includes(role));
  }, [user?.merchantRole]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-border">
        <div className="flex items-center h-14 px-4 max-w-[1600px] mx-auto">
          <Link href="/app" className="flex items-center gap-2 mr-6 shrink-0">
            <img src={logoUrl} alt="PPD Repair" className="w-16 h-16 rounded-lg" />
            <span className="font-bold text-sm tracking-tight hidden sm:block text-foreground">PPD Repair</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/app" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    data-testid={`nav-merchant-${item.label.toLowerCase()}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>

          <button
            className="lg:hidden mr-2 p-2 rounded-md hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <StoreSelector />
          <StationSelector />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto" data-testid="button-user-dropdown">
                {merchantLogo ? (
                  <img src={merchantLogo} alt="Logo" className="w-7 h-7 rounded-full object-cover" data-testid="img-header-merchant-logo" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-foreground">{user?.firstName} {user?.lastName}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                {roleLabel}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} data-testid="button-sign-out">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {mobileOpen && (
          <nav className="lg:hidden border-t border-border px-4 py-2 space-y-1 bg-white dark:bg-slate-900">
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path !== "/app" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm ${
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <MerchantLayoutInner>{children}</MerchantLayoutInner>
  );
}
