import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  Users,
  Zap,
  FileText,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import type { Payment } from "@shared/schema";

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(isNaN(num) ? 0 : num);
};

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const formatTimeAgo = (date: Date) => {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

function makeYAxisFormatter(data: { volume: number }[]) {
  const max = Math.max(...data.map((d) => d.volume), 0);
  if (max === 0) return () => "$0";
  if (max >= 10000) return (v: number) => `$${(v / 1000).toFixed(0)}k`;
  if (max >= 1000) return (v: number) => `$${(v / 1000).toFixed(1)}k`;
  return (v: number) => `$${v.toFixed(0)}`;
}

function makeVolumeDomain(data: { volume: number }[]): [number, number] {
  const max = Math.max(...data.map((d) => d.volume), 0);
  return [0, max === 0 ? 10 : max * 1.15];
}

function makeCountDomain(data: { count: number }[]): [number, number] {
  const max = Math.max(...data.map((d) => d.count), 0);
  return [0, max === 0 ? 5 : max + Math.ceil(max * 0.2)];
}

const tenderLabel: Record<string, string> = {
  card: "Card",
  ach: "ACH",
  cash: "Cash",
  check: "Check",
};

const statusConfig: Record<string, { color: string; dot: string }> = {
  approved:  { color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
  settled:   { color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
  pending:   { color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-400" },
  declined:  { color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  voided:    { color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "bg-gray-400" },
  refunded:  { color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500" },
};

function StatusPill({ status }: { status: string }) {
  const cfg = statusConfig[status?.toLowerCase()] ?? statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  loading,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase mb-1.5">{title}</p>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1.5">{value}</p>
              {(description || trend) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {trend && (
                    <span className={`font-semibold ${trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {trend.isPositive ? "▲" : "▼"} {Math.abs(trend.value)}%
                    </span>
                  )}
                  {description}
                </p>
              )}
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpWidget({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
  bgClass,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconClass: string;
  bgClass: string;
  alert?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3.5 ${alert ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10" : "bg-card"}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${bgClass}`}>
        <Icon className={`h-4.5 w-4.5 ${iconClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase leading-none mb-0.5">{label}</p>
        <p className={`text-lg font-bold leading-tight ${alert ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltipVolume = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

const CustomTooltipCount = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} transaction{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

export default function DashboardPage() {
  const { tenant } = useAuth();
  const [lastUpdated] = React.useState(() => new Date());

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalVolume: number;
    transactionCount: number;
    approvalRate: number;
    customerCount: number;
    volumeTrend: number;
    transactionTrend: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: recentPayments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments?limit=8"],
  });

  const { data: chartData } = useQuery<{ date: string; volume: number; count: number }[]>({
    queryKey: ["/api/dashboard/chart"],
  });

  const { data: ops, isLoading: opsLoading } = useQuery<{
    openInvoices: number;
    openInvoicesAmount: number;
    failedPayments: number;
    pendingAch: number;
    activeContracts: number;
    failedContracts: number;
  }>({ queryKey: ["/api/dashboard/operational"] });

  const safeChartData = chartData ?? [];
  const yAxisFormatter = makeYAxisFormatter(safeChartData);
  const volumeDomain = makeVolumeDomain(safeChartData);
  const countDomain = makeCountDomain(safeChartData);
  const hasVolumeData = safeChartData.some((d) => d.volume > 0);
  const hasCountData = safeChartData.some((d) => d.count > 0);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Command Bar Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <span className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Last 7 days
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {tenant?.name || "Your business"} &mdash;{" "}
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Updated {formatTimeAgo(lastUpdated)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/quick-payment">
            <Button size="sm" className="gap-1.5 shadow-sm" data-testid="button-take-payment">
              <Zap className="h-3.5 w-3.5" />
              Take Payment
            </Button>
          </Link>
          <Link href="/invoice">
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-send-invoice">
              <FileText className="h-3.5 w-3.5" />
              Send Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Volume"
          value={formatCurrency(stats?.totalVolume ?? 0)}
          icon={DollarSign}
          trend={stats?.volumeTrend ? { value: stats.volumeTrend, isPositive: stats.volumeTrend > 0 } : undefined}
          description="vs prior 7 days"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          loading={statsLoading}
        />
        <KpiCard
          title="Transactions"
          value={(stats?.transactionCount ?? 0).toLocaleString()}
          icon={CreditCard}
          trend={stats?.transactionTrend ? { value: stats.transactionTrend, isPositive: stats.transactionTrend > 0 } : undefined}
          description="vs prior 7 days"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          loading={statsLoading}
        />
        <KpiCard
          title="Approval Rate"
          value={`${(stats?.approvalRate ?? 0).toFixed(1)}%`}
          icon={TrendingUp}
          description="All payment methods"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          loading={statsLoading}
        />
        <KpiCard
          title="Open Invoice Balance"
          value={formatCurrency(ops?.openInvoicesAmount ?? 0)}
          icon={FileText}
          description={ops ? `${ops.openInvoices} invoice${ops.openInvoices !== 1 ? "s" : ""} outstanding` : undefined}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
          loading={statsLoading || opsLoading}
        />
      </div>

      {/* ── Operational Widgets ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpWidget
          icon={ops?.failedPayments ? AlertTriangle : CheckCircle2}
          label="Failed Payments"
          value={ops?.failedPayments ?? "—"}
          sub="Last 7 days"
          bgClass={ops?.failedPayments ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}
          iconClass={ops?.failedPayments ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
          alert={!!(ops?.failedPayments && ops.failedPayments > 0)}
        />
        <Link href="/invoices">
          <OpWidget
            icon={FileText}
            label="Awaiting Collection"
            value={ops?.openInvoices ?? "—"}
            sub={ops?.openInvoices === 0 ? "No open invoices" : `${ops?.openInvoices ?? 0} invoice${(ops?.openInvoices ?? 0) !== 1 ? "s" : ""} to collect`}
            bgClass="bg-amber-100 dark:bg-amber-900/30"
            iconClass="text-amber-600 dark:text-amber-400"
          />
        </Link>
        <OpWidget
          icon={Clock}
          label="Pending ACH"
          value={ops?.pendingAch ?? "—"}
          sub="Awaiting settlement"
          bgClass="bg-sky-100 dark:bg-sky-900/30"
          iconClass="text-sky-600 dark:text-sky-400"
        />
        <Link href="/recurring">
          <OpWidget
            icon={ops?.failedContracts ? XCircle : CheckCircle2}
            label="Recurring Health"
            value={ops?.failedContracts ? ops.failedContracts : (ops?.activeContracts ?? "—")}
            sub={
              ops?.failedContracts
                ? `contract${ops.failedContracts !== 1 ? "s" : ""} need attention`
                : `${ops?.activeContracts ?? 0} active · all healthy`
            }
            bgClass={ops?.failedContracts ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}
            iconClass={ops?.failedContracts ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
            alert={!!(ops?.failedContracts && ops.failedContracts > 0)}
          />
        </Link>
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Transaction Volume</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Daily $ processed — last 7 days</p>
              </div>
              {hasVolumeData && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Volume
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={yAxisFormatter}
                    domain={volumeDomain}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltipVolume />} />
                  <Area
                    type="monotoneX"
                    dataKey="volume"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#volumeGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!hasVolumeData && (
              <p className="text-center text-xs text-muted-foreground -mt-2">No volume in the last 7 days</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Daily Transactions</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Count per day — last 7 days</p>
              </div>
              {hasCountData && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  Txns
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={countDomain}
                    width={32}
                  />
                  <Tooltip content={<CustomTooltipCount />} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.85}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {!hasCountData && (
              <p className="text-center text-xs text-muted-foreground -mt-2">No transactions in the last 7 days</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Transactions ── */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest payment activity</p>
            </div>
            <Link href="/payments">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2 text-muted-foreground hover:text-foreground" data-testid="link-view-all-payments">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {paymentsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : !recentPayments?.length ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm" data-testid="table-recent-transactions">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2.5 pl-1 pr-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Reference</th>
                    <th className="pb-2.5 pr-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase text-right">Amount</th>
                    <th className="pb-2.5 pr-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status</th>
                    <th className="pb-2.5 pr-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Type</th>
                    <th className="pb-2.5 pr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-payment-${payment.id}`}>
                      <td className="py-3 pl-1 pr-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {payment.referenceNumber || payment.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-semibold tabular-nums text-foreground">{formatCurrency(payment.amount)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill status={payment.status || "pending"} />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs text-muted-foreground font-medium">
                          {tenderLabel[payment.tenderType?.toLowerCase() ?? ""] ?? payment.tenderType}
                        </span>
                      </td>
                      <td className="py-3 pr-1 text-right">
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {formatDate(payment.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
