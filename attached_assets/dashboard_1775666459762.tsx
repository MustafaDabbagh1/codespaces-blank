import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MerchantLayout from "@/components/merchant-layout";
import { useStoreContext } from "@/contexts/store-context";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowDownUp, Receipt,
  Ticket, Bell, Package, CreditCard, Timer,
  Search, Calendar, Wallet,
  AlertTriangle, BarChart3, ShoppingCart, Wrench,
  Clock, AlertCircle, Ban, XCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  waiting_on_parts: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  ready_for_pickup: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  picked_up: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PIE_COLORS = ["#10b981", "#3b82f6"];

interface DashboardData {
  kpis: {
    grossSales: string;
    netSales: string;
    netProfit: string;
    avgTicket: string;
    refundsVoidsTotal: string;
    refundsVoidsCount: number;
    outstandingRepairBalances: string;
    taxCollected: string;
    cogs: string;
    cardSalesVolume: string;
  };
  priorPeriod: {
    grossSales: string;
    netSales: string;
    netProfit: string;
    avgTicket: string;
    refundsVoidsTotal: string;
  };
  opsKpis: {
    openTickets: number;
    readyForPickup: number;
    overdueRepairs: number;
    lowStockAlerts: number;
    depositsHeld: string;
    readyPickupOver3: number;
    readyPickupOver7: number;
  };
  salesTrend: Array<{ date: string; sales: number; cogs: number; profit: number }>;
  paymentBreakdown: {
    cashTotal: string;
    cardTotal: string;
    totalPayments: number;
    dualPricingUplift: string;
    cashPercent: string;
    cardPercent: string;
  };
  recentSales: Array<{
    id: number;
    saleNumber: string;
    customerName: string | null;
    finalTotal: string;
    paymentMethod: string;
    employeeName: string | null;
    createdAt: string;
  }>;
  recentTickets: Array<{
    id: number;
    ticketNumber: string;
    customerName: string | null;
    device: string;
    status: string;
    assignedTechName: string | null;
    updatedAt: string;
  }>;
  inventoryAlerts: Array<{
    id: number;
    name: string;
    type: string;
    currentStock: number;
    threshold: number;
  }>;
  salesByCategory: Array<{
    category: string;
    revenue: string;
    units: number;
    cogs: string;
    profit: string;
  }>;
  exceptions: {
    overdueList: Array<{
      id: number;
      ticketNumber: string;
      customerName: string | null;
      device: string;
      status: string;
      dueDate: string | null;
      createdAt: string;
      balance: string;
    }>;
    overdueTotalBalance: string;
    stalePickupList: Array<{
      id: number;
      ticketNumber: string;
      customerName: string | null;
      device: string;
      readySince: string;
      daysWaiting: number;
      balance: string;
    }>;
    stalePickupTotalBalance: string;
    unpaidBalanceList: Array<{
      id: number;
      ticketNumber: string;
      customerName: string | null;
      device: string;
      balance: string;
      invoiceTotal: string;
      depositHeld: string;
      status: string;
    }>;
    unpaidTotalBalance: string;
    outOfStockItems: Array<{
      id: number;
      name: string;
      type: string;
      currentStock: number;
      threshold: number;
    }>;
  };
  stores: Array<{ id: number; name: string }>;
  employees: Array<{ id: number; name: string; role: string | null }>;
  filters: {
    startDate: string;
    endDate: string;
    storeId: number | null;
    employeeId: number | null;
    preset: string | null;
  };
}

function fmt(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { selectedStoreId, isMultiStore } = useStoreContext();
  const [preset, setPreset] = useState("today");
  const [storeId, setStoreId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedParams, setAppliedParams] = useState<Record<string, string>>({ datePreset: "today" });

  const role = user?.merchantRole || "";
  const canViewDashboard = role === "owner" || role === "manager";

  useEffect(() => {
    if (user && !canViewDashboard) {
      navigate("/app/pos", { replace: true });
    }
  }, [user, canViewDashboard, navigate]);

  useEffect(() => {
    if (isMultiStore && selectedStoreId) {
      setStoreId(String(selectedStoreId));
      setAppliedParams(prev => ({ ...prev, storeId: String(selectedStoreId) }));
    } else if (!isMultiStore) {
      setStoreId("");
      setAppliedParams(prev => {
        const { storeId: _, ...rest } = prev;
        return rest;
      });
    }
  }, [selectedStoreId, isMultiStore]);

  const qs = new URLSearchParams(appliedParams).toString();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/merchant/dashboard" + (qs ? `?${qs}` : "")],
    enabled: canViewDashboard,
  });

  if (!canViewDashboard) return null;

  function applyFilters() {
    const params: Record<string, string> = {};
    if (startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    } else {
      params.datePreset = preset;
    }
    if (storeId) params.storeId = storeId;
    if (employeeId) params.employeeId = employeeId;
    setAppliedParams(params);
  }

  function applyPreset(p: string) {
    setPreset(p);
    setStartDate("");
    setEndDate("");
    const params: Record<string, string> = { datePreset: p };
    if (storeId) params.storeId = storeId;
    if (employeeId) params.employeeId = employeeId;
    setAppliedParams(params);
  }

  if (isLoading) {
    return (
      <MerchantLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-14" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </MerchantLayout>
    );
  }

  const kpis = data?.kpis;
  const ops = data?.opsKpis;
  const paymentData = data?.paymentBreakdown;
  const exceptions = data?.exceptions;
  const pieData = [
    { name: "Cash", value: parseFloat(paymentData?.cashTotal || "0") },
    { name: "Card", value: parseFloat(paymentData?.cardTotal || "0") },
  ].filter(d => d.value > 0);

  const totalExceptions = (exceptions?.overdueList?.length || 0) + (exceptions?.stalePickupList?.length || 0) +
    (exceptions?.unpaidBalanceList?.length || 0) + (exceptions?.outOfStockItems?.length || 0);

  const getSeverityRank = (item: { currentStock: number; threshold: number }) => {
    if (item.currentStock === 0) return 0;
    if (item.currentStock <= Math.floor(item.threshold * 0.5)) return 1;
    return 2;
  };
  const sortedAlerts = [...(data?.inventoryAlerts || [])].sort((a, b) => {
    const rankA = getSeverityRank(a);
    const rankB = getSeverityRank(b);
    if (rankA !== rankB) return rankA - rankB;
    const aRatio = a.threshold > 0 ? a.currentStock / a.threshold : 1;
    const bRatio = b.threshold > 0 ? b.currentStock / b.threshold : 1;
    return aRatio - bRatio;
  });

  return (
    <MerchantLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.stores && appliedParams.storeId ? (
                <>Showing data for <span className="font-medium text-foreground">{data.stores.find(s => s.id.toString() === appliedParams.storeId)?.name || "Selected Store"}</span></>
              ) : data?.stores && data.stores.length > 1 && role === "owner" ? (
                <>Showing data across <span className="font-medium text-foreground">all {data.stores.length} stores</span></>
              ) : data?.stores && data.stores.length > 1 ? (
                <>Showing data for <span className="font-medium text-foreground">{data.stores.length} assigned stores</span></>
              ) : (
                "Operational overview and reporting"
              )}
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="border-card-border">
          <CardContent className="p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map(p => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={preset === p.value && !startDate ? "default" : "outline"}
                  onClick={() => applyPreset(p.value)}
                  data-testid={`button-preset-${p.value}`}
                  className="text-xs h-7 px-2"
                >
                  {p.label}
                </Button>
              ))}

              <div className="h-5 w-px bg-border shrink-0 hidden lg:block" />

              <div className="flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPreset(""); }}
                  className="h-7 w-[145px] text-xs px-1.5 [&::-webkit-calendar-picker-indicator]:ml-0 [&::-webkit-calendar-picker-indicator]:p-0"
                  data-testid="input-start-date"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPreset(""); }}
                  className="h-7 w-[145px] text-xs px-1.5 [&::-webkit-calendar-picker-indicator]:ml-0 [&::-webkit-calendar-picker-indicator]:p-0"
                  data-testid="input-end-date"
                />
                {(startDate && endDate) && (
                  <Button size="sm" className="h-7 px-2.5 text-xs" onClick={applyFilters} data-testid="button-apply-filters">
                    <Search className="w-3 h-3 mr-1" /> Apply
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 lg:ml-auto">
                {data?.stores && data.stores.length > 1 && (
                  <Select value={storeId || "all"} onValueChange={(v) => {
                    const newVal = v === "all" ? "" : v;
                    setStoreId(newVal);
                    setAppliedParams(prev => {
                      const next = { ...prev };
                      if (newVal) next.storeId = newVal; else delete next.storeId;
                      return next;
                    });
                  }}>
                    <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="select-store-filter">
                      <SelectValue placeholder={role === "owner" ? "All Stores" : "Select Store"} />
                    </SelectTrigger>
                    <SelectContent>
                      {role === "owner" && <SelectItem value="all">All Stores</SelectItem>}
                      {data.stores.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {data?.employees && data.employees.length > 1 && (
                  <Select value={employeeId || "all"} onValueChange={(v) => {
                    const newVal = v === "all" ? "" : v;
                    setEmployeeId(newVal);
                    setAppliedParams(prev => {
                      const next = { ...prev };
                      if (newVal) next.employeeId = newVal; else delete next.employeeId;
                      return next;
                    });
                  }}>
                    <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="select-employee-filter">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {data.employees.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 1: Financial KPIs */}
        <div className="space-y-2.5">
          <SectionHeader title="Financial" icon={DollarSign} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={DollarSign} label="Gross Sales" value={`$${fmt(kpis?.grossSales || "0")}`} color="text-emerald-600" testId="kpi-gross-sales" comparison={getComparison(kpis?.grossSales, data?.priorPeriod?.grossSales)} primary />
            <KpiCard icon={TrendingUp} label="Net Sales" value={`$${fmt(kpis?.netSales || "0")}`} color="text-emerald-700" testId="kpi-net-sales" comparison={getComparison(kpis?.netSales, data?.priorPeriod?.netSales)} />
            <KpiCard icon={TrendingUp} label="Net Profit" value={`$${fmt(kpis?.netProfit || "0")}`} color="text-green-600" testId="kpi-profit" comparison={getComparison(kpis?.netProfit, data?.priorPeriod?.netProfit)} primary />
            <KpiCard icon={Receipt} label="Avg Ticket" value={`$${fmt(kpis?.avgTicket || "0")}`} color="text-blue-600" testId="kpi-avg-ticket" comparison={getComparison(kpis?.avgTicket, data?.priorPeriod?.avgTicket)} />
            <KpiCard
              icon={ArrowDownUp}
              label="Refunds / Voids"
              value={`$${fmt(kpis?.refundsVoidsTotal || "0")}`}
              subtitle={`${kpis?.refundsVoidsCount || 0} refund/void transactions`}
              color={parseFloat(kpis?.refundsVoidsTotal || "0") > 0 ? "text-red-600" : "text-muted-foreground"}
              testId="kpi-refunds-voids"
              comparison={getComparison(kpis?.refundsVoidsTotal, data?.priorPeriod?.refundsVoidsTotal, true)}
            />
            <KpiCard
              icon={Wallet}
              label="Outstanding Balances"
              value={`$${fmt(kpis?.outstandingRepairBalances || "0")}`}
              color={parseFloat(kpis?.outstandingRepairBalances || "0") > 0 ? "text-amber-600" : "text-muted-foreground"}
              testId="kpi-repair-balances"
            />
          </div>
        </div>

        {/* Row 2: Ops KPIs */}
        <div className="space-y-2.5">
          <SectionHeader title="Operations" icon={Wrench} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Ticket} label="Open Tickets" value={String(ops?.openTickets ?? 0)} color="text-amber-600" testId="kpi-open-tickets" />
          <KpiCard icon={Bell} label="Ready for Pickup" value={String(ops?.readyForPickup ?? 0)} color="text-violet-600" testId="kpi-ready-pickup" />
          <KpiCard
            icon={Clock}
            label="Overdue Repairs"
            value={String(ops?.overdueRepairs ?? 0)}
            color={ops?.overdueRepairs ? "text-red-600" : "text-muted-foreground"}
            testId="kpi-overdue-repairs"
          />
          <KpiCard
            icon={Package}
            label="Low Stock"
            value={String(ops?.lowStockAlerts ?? 0)}
            color={ops?.lowStockAlerts ? "text-red-600" : "text-muted-foreground"}
            testId="kpi-low-stock"
          />
          <KpiCard
            icon={CreditCard}
            label="Repair Deposits Held"
            value={`$${fmt(ops?.depositsHeld || "0")}`}
            color="text-indigo-600"
            testId="kpi-deposits-held"
          />
          <KpiCard
            icon={Timer}
            label="Aging Pickups"
            value=""
            agingContent={{ over3: ops?.readyPickupOver3 ?? 0, over7: ops?.readyPickupOver7 ?? 0 }}
            color={ops?.readyPickupOver7 ? "text-red-600" : ops?.readyPickupOver3 ? "text-amber-600" : "text-muted-foreground"}
            testId="kpi-pickup-aging"
          />
          </div>
        </div>

        {/* Row 3: Charts */}
        <SectionHeader title="Trends & Payments" icon={BarChart3} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="border-card-border lg:col-span-3">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" /> Sales Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {data?.salesTrend && data.salesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v + "T00:00:00"), "MMM d"); } catch { return v; } }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} className="text-muted-foreground" />
                    <RechartsTooltip formatter={(v: number) => [`$${fmt(v)}`, ""]} labelFormatter={(l) => { try { return format(new Date(l + "T00:00:00"), "MMM d, yyyy"); } catch { return l; } }} />
                    <Area type="monotone" dataKey="sales" stroke="#10b981" fill="url(#gradSales)" strokeWidth={2} name="Sales" />
                    <Area type="monotone" dataKey="cogs" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="COGS" />
                    <Area type="monotone" dataKey="profit" stroke="#3b82f6" fill="url(#gradProfit)" strokeWidth={2} name="Profit" />
                    <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-60 text-sm text-muted-foreground" data-testid="text-no-trend">
                  No sales data for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-card-border lg:col-span-2">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {pieData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(v: number) => [`$${fmt(v)}`, ""]} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-36 text-sm text-muted-foreground">No payments this period</div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="p-2.5 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground">Cash</div>
                  <div className="text-sm font-semibold mt-0.5" data-testid="text-cash-total">${fmt(paymentData?.cashTotal || "0")}</div>
                  <div className="text-[10px] text-muted-foreground">{paymentData?.cashPercent || "0"}%</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground">Card</div>
                  <div className="text-sm font-semibold mt-0.5" data-testid="text-card-total">${fmt(paymentData?.cardTotal || "0")}</div>
                  <div className="text-[10px] text-muted-foreground">{paymentData?.cardPercent || "0"}%</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground">Transactions</div>
                  <div className="text-sm font-semibold mt-0.5" data-testid="text-total-payments">{paymentData?.totalPayments ?? 0}</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground">Card Uplift</div>
                  <div className="text-sm font-semibold mt-0.5" data-testid="text-uplift">${fmt(paymentData?.dualPricingUplift || "0")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Tables */}
        <SectionHeader title="Recent Activity" icon={ShoppingCart} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Transactions */}
          <Card className="border-card-border">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-muted-foreground" /> Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Sale #</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs">Employee</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.recentSales && data.recentSales.length > 0 ? (
                      data.recentSales.map(s => (
                        <TableRow
                          key={s.id}
                          data-testid={`row-sale-${s.id}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/app/sales/${s.id}`)}
                        >
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            <span className="text-primary">{s.saleNumber}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{s.customerName || "Walk-in"}</TableCell>
                          <TableCell className="text-xs font-medium text-right font-mono whitespace-nowrap">${fmt(s.finalTotal)}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{s.paymentMethod}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.employeeName || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(s.createdAt), "MMM d, h:mm a")}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No transactions this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card className="border-card-border">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" /> Recent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[80px]">Ticket #</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs max-w-[140px]">Device</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Tech</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.recentTickets && data.recentTickets.length > 0 ? (
                      data.recentTickets.map(t => {
                        const updDate = new Date(t.updatedAt);
                        const now = new Date();
                        const daysSince = Math.floor((now.getTime() - updDate.getTime()) / (1000 * 60 * 60 * 24));
                        const isStale = t.status === "ready_for_pickup" && daysSince >= 3;
                        return (
                          <TableRow
                            key={t.id}
                            data-testid={`row-ticket-${t.id}`}
                            className={`cursor-pointer hover:bg-muted/50 ${isStale ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                            onClick={() => navigate(`/app/tickets/${t.id}`)}
                          >
                            <TableCell className="text-xs font-medium">
                              <span className="text-primary">{t.ticketNumber}</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{t.customerName || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]" title={t.device}>{t.device}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] whitespace-nowrap ${STATUS_COLORS[t.status] || "bg-muted text-muted-foreground"}`}>
                                {t.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{t.assignedTechName || "Unassigned"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <span className={isStale ? "text-amber-600 font-medium" : ""}>
                                {formatDistanceToNow(updDate, { addSuffix: true })}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No recent tickets</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 5: Exceptions + Inventory */}
        <SectionHeader title="Attention Required" icon={AlertCircle} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Exceptions Panel */}
          <Card className={totalExceptions > 0 ? "border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10" : "border-card-border"}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${totalExceptions > 0 ? "text-red-500" : "text-muted-foreground"}`} /> Needs Attention
                {totalExceptions > 0 && (
                  <Badge variant="destructive" className="text-[10px] ml-1">{totalExceptions}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {totalExceptions === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Nothing needs attention right now</p>
                </div>
              ) : (
                <Tabs defaultValue={
                  exceptions?.overdueList?.length ? "overdue" :
                  exceptions?.stalePickupList?.length ? "stale" :
                  exceptions?.unpaidBalanceList?.length ? "unpaid" : "oos"
                } className="w-full">
                  <div className="px-4 pt-1">
                    <TabsList className="w-full h-8">
                      {(exceptions?.overdueList?.length ?? 0) > 0 && (
                        <TabsTrigger value="overdue" className="text-xs gap-1 flex-1" data-testid="tab-overdue">
                          <Clock className="w-3 h-3" /> Overdue ({exceptions!.overdueList.length})
                        </TabsTrigger>
                      )}
                      {(exceptions?.stalePickupList?.length ?? 0) > 0 && (
                        <TabsTrigger value="stale" className="text-xs gap-1 flex-1" data-testid="tab-stale-pickup">
                          <Timer className="w-3 h-3" /> Stale Pickup ({exceptions!.stalePickupList.length})
                        </TabsTrigger>
                      )}
                      {(exceptions?.unpaidBalanceList?.length ?? 0) > 0 && (
                        <TabsTrigger value="unpaid" className="text-xs gap-1 flex-1" data-testid="tab-unpaid">
                          <DollarSign className="w-3 h-3" /> Unpaid ({exceptions!.unpaidBalanceList.length})
                        </TabsTrigger>
                      )}
                      {(exceptions?.outOfStockItems?.length ?? 0) > 0 && (
                        <TabsTrigger value="oos" className="text-xs gap-1 flex-1" data-testid="tab-out-of-stock">
                          <Ban className="w-3 h-3" /> Out of Stock ({exceptions!.outOfStockItems.length})
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </div>

                  {(exceptions?.overdueList?.length ?? 0) > 0 && (
                    <TabsContent value="overdue" className="mt-0">
                      {parseFloat(exceptions!.overdueTotalBalance) > 0 && (
                        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b">
                          Total exposure: <span className="font-semibold text-red-600">${fmt(exceptions!.overdueTotalBalance)}</span>
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ticket</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Balance Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exceptions!.overdueList.map(t => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/app/tickets/${t.id}`)}
                              data-testid={`row-overdue-${t.id}`}
                            >
                              <TableCell className="text-xs font-medium text-primary">{t.ticketNumber}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{t.customerName || "—"}</TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] ${STATUS_COLORS[t.status] || "bg-muted text-muted-foreground"}`}>
                                  {t.status.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium font-mono">
                                {parseFloat(t.balance) > 0 ? <span className="text-red-600">${fmt(t.balance)}</span> : <span className="text-muted-foreground">$0.00</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  )}

                  {(exceptions?.stalePickupList?.length ?? 0) > 0 && (
                    <TabsContent value="stale" className="mt-0">
                      {parseFloat(exceptions!.stalePickupTotalBalance) > 0 && (
                        <div className="px-4 py-1.5 text-xs text-muted-foreground border-b">
                          Total balance due: <span className="font-semibold text-amber-600">${fmt(exceptions!.stalePickupTotalBalance)}</span>
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ticket</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs text-right">Balance Due</TableHead>
                            <TableHead className="text-xs text-right">Days</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exceptions!.stalePickupList.map(t => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/app/tickets/${t.id}`)}
                              data-testid={`row-stale-${t.id}`}
                            >
                              <TableCell className="text-xs font-medium text-primary">{t.ticketNumber}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{t.customerName || "—"}</TableCell>
                              <TableCell className="text-xs text-right font-medium font-mono">
                                {parseFloat(t.balance) > 0 ? <span className="text-amber-600">${fmt(t.balance)}</span> : <span className="text-muted-foreground">$0.00</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                <Badge variant={t.daysWaiting >= 7 ? "destructive" : "secondary"} className="text-[10px]">
                                  {t.daysWaiting}d
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  )}

                  {(exceptions?.unpaidBalanceList?.length ?? 0) > 0 && (
                    <TabsContent value="unpaid" className="mt-0">
                      <div className="px-4 py-1.5 text-xs text-muted-foreground border-b">
                        Total outstanding: <span className="font-semibold text-red-600">${fmt(exceptions!.unpaidTotalBalance)}</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ticket</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs text-right">Invoice</TableHead>
                            <TableHead className="text-xs text-right">Balance Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exceptions!.unpaidBalanceList.map(t => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/app/tickets/${t.id}`)}
                              data-testid={`row-unpaid-${t.id}`}
                            >
                              <TableCell className="text-xs font-medium text-primary">{t.ticketNumber}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{t.customerName || "—"}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-muted-foreground">${fmt(t.invoiceTotal)}</TableCell>
                              <TableCell className="text-xs text-right font-medium font-mono text-red-600">${fmt(t.balance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  )}

                  {(exceptions?.outOfStockItems?.length ?? 0) > 0 && (
                    <TabsContent value="oos" className="mt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs text-center">Threshold</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exceptions!.outOfStockItems.map(item => (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/app/inventory`)}
                              data-testid={`row-oos-${item.id}`}
                            >
                              <TableCell className="text-xs font-medium">{item.name}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{item.type}</Badge></TableCell>
                              <TableCell className="text-xs text-center text-muted-foreground">{item.threshold}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Inventory Alerts */}
          <Card className={sortedAlerts.length > 0 ? "border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10" : "border-card-border"}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${sortedAlerts.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} /> Inventory Alerts
                {sortedAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] ml-1">{sortedAlerts.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-center">Stock</TableHead>
                    <TableHead className="text-xs text-center">Threshold</TableHead>
                    <TableHead className="text-xs text-center">Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAlerts.length > 0 ? (
                    sortedAlerts.map(a => {
                      const severity = a.currentStock === 0 ? "critical" : a.currentStock <= Math.floor(a.threshold * 0.5) ? "warning" : "low";
                      return (
                        <TableRow
                          key={a.id}
                          data-testid={`row-alert-${a.id}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate("/app/inventory")}
                        >
                          <TableCell className="text-xs font-medium">{a.name}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{a.type}</Badge></TableCell>
                          <TableCell className="text-xs text-center font-medium">
                            <span className={a.currentStock === 0 ? "text-red-600" : "text-amber-600"}>
                              {a.currentStock}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-center text-muted-foreground">{a.threshold}</TableCell>
                          <TableCell className="text-center">
                            {severity === "critical" ? (
                              <Badge variant="destructive" className="text-[10px]">
                                <XCircle className="w-2.5 h-2.5 mr-0.5" /> Critical
                              </Badge>
                            ) : severity === "warning" ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Warning
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Low</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">All inventory levels healthy</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </MerchantLayout>
  );
}

function getComparison(current?: string, prior?: string, lowerIsBetter = false): { pct: number; label: string; positive: boolean } | null {
  if (!current || !prior) return null;
  const cur = parseFloat(current);
  const prev = parseFloat(prior);
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return { pct: 0, label: "New vs prior", positive: !lowerIsBetter };
  const pctChange = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pctChange) < 0.1) return { pct: 0, label: "Flat vs prior", positive: true };
  const positive = lowerIsBetter ? pctChange < 0 : pctChange > 0;
  return { pct: Math.abs(pctChange), label: `${Math.abs(pctChange).toFixed(1)}% vs prior`, positive };
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, subtitle, color, testId, comparison, agingContent, primary }: {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  testId: string;
  comparison?: { pct: number; label: string; positive: boolean } | null;
  agingContent?: { over3: number; over7: number };
  primary?: boolean;
}) {
  return (
    <Card className={`border-card-border ${primary ? "ring-1 ring-primary/20 border-primary/30" : ""}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`shrink-0 p-2 rounded-lg ${primary ? "bg-primary/10" : "bg-muted/60"} ${color}`}>
          <Icon className={primary ? "w-5 h-5" : "w-4 h-4"} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
          {agingContent ? (
            <div className="mt-0.5 space-y-0.5" data-testid={testId}>
              <div className="text-xs font-semibold leading-tight">3+ days: <span className="font-bold">{agingContent.over3}</span></div>
              <div className="text-xs font-semibold leading-tight">7+ days: <span className="font-bold">{agingContent.over7}</span></div>
            </div>
          ) : (
            <div className={`${primary ? "text-lg" : "text-base"} font-bold leading-tight mt-0.5`} data-testid={testId}>{value}</div>
          )}
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
          {comparison && (
            <div className={`text-[10px] mt-0.5 flex items-center gap-0.5 ${comparison.positive ? "text-emerald-600" : "text-red-600"}`}>
              {comparison.pct > 0 && (comparison.positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />)}
              {comparison.label}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
