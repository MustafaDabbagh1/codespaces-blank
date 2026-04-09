import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Search,
  Download,
  MoreHorizontal,
  Ban,
  Eye,
  Loader2,
  RotateCcw,
  Mail,
  Send,
  ArrowUpDown,
  ShoppingBag,
  FileText,
  Repeat,
  CreditCard,
  Zap,
  Globe,
  HelpCircle,
  AlertTriangle,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { Payment, Customer } from "@shared/schema";

type EnrichedPayment = Payment & {
  sourceType?: string;
  sourceRef?: string | null;
};

const formatCurrency = (amount: number | string | null | undefined) => {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
};

const formatDateShort = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

const formatDateCompact = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal capitalize">
          Approved
        </Badge>
      );
    case "settled":
      return (
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal capitalize">
          Settled
        </Badge>
      );
    case "refunded":
      return (
        <Badge variant="outline" className="border-blue-300 text-blue-700 font-normal capitalize">
          Refunded
        </Badge>
      );
    case "voided":
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal capitalize">
          Voided
        </Badge>
      );
    case "declined":
      return <Badge variant="destructive" className="capitalize">Declined</Badge>;
    case "pending":
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal capitalize">
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal capitalize">
          {status}
        </Badge>
      );
  }
}

function StatusDot({ status }: { status: string }) {
  const color = status === "approved" || status === "settled" ? "bg-emerald-500"
    : status === "declined" ? "bg-destructive"
    : status === "voided" ? "bg-amber-500"
    : status === "refunded" ? "bg-blue-500"
    : status === "pending" ? "bg-muted-foreground"
    : "bg-muted-foreground";
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function AmountCell({ payment }: { payment: Payment }) {
  const status = payment.status || "pending";
  const amount = formatCurrency(payment.amount);
  if (status === "declined" || status === "voided") {
    return (
      <span className="text-sm font-medium tabular-nums text-muted-foreground line-through">
        {amount}
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="text-sm font-semibold tabular-nums text-blue-700">
        {amount}
      </span>
    );
  }
  return (
    <span className="text-sm font-semibold tabular-nums">
      {amount}
    </span>
  );
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof ShoppingBag; color: string }> = {
  order: { label: "Order", icon: ShoppingBag, color: "text-blue-600 dark:text-blue-400" },
  shop_agent: { label: "Shop Agent", icon: ShoppingBag, color: "text-sky-600 dark:text-sky-400" },
  shop_customer: { label: "Shop Customer", icon: ShoppingBag, color: "text-teal-600 dark:text-teal-400" },
  invoice: { label: "Invoice", icon: FileText, color: "text-violet-600 dark:text-violet-400" },
  recurring: { label: "Recurring", icon: Repeat, color: "text-emerald-600 dark:text-emerald-400" },
  pos: { label: "POS", icon: CreditCard, color: "text-orange-600 dark:text-orange-400" },
  quick_payment: { label: "Quick Pay", icon: Zap, color: "text-amber-600 dark:text-amber-400" },
  external: { label: "External", icon: Globe, color: "text-muted-foreground" },
  unknown: { label: "Unknown", icon: HelpCircle, color: "text-muted-foreground" },
};

function SourceBadge({ sourceType, sourceRef, compact }: { sourceType: string; sourceRef?: string | null; compact?: boolean }) {
  const config = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className="flex flex-col min-w-0">
      <span className={`text-xs font-medium flex items-center gap-1 ${config.color}`} data-testid="text-source-type">
        <Icon className="h-3 w-3 shrink-0" />
        {config.label}
      </span>
      {sourceRef && !compact && (
        <span className="text-[11px] text-muted-foreground/70 leading-tight truncate" data-testid="text-source-ref">
          {(sourceType === "order" || sourceType === "shop_agent" || sourceType === "shop_customer") ? `#${sourceRef}` : sourceType === "invoice" ? sourceRef : sourceRef}
        </span>
      )}
    </div>
  );
}

function SourceInline({ sourceType, sourceRef }: { sourceType: string; sourceRef?: string | null }) {
  const config = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.unknown;
  const Icon = config.icon;
  const refText = sourceRef
    ? (sourceType === "order" || sourceType === "shop_agent" || sourceType === "shop_customer") ? ` #${sourceRef}`
    : sourceType === "invoice" ? ` ${sourceRef}`
    : ` ${sourceRef}`
    : "";
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-1 ${config.color}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {config.label}{refText && <span className="text-muted-foreground font-normal truncate max-w-[100px]">{refText}</span>}
    </span>
  );
}

function getDeclineReason(payment: Payment): string | null {
  if (!payment.processorResponse) return null;
  if (typeof payment.processorResponse === "string") return payment.processorResponse;
  const resp = payment.processorResponse as any;
  return resp?.message || resp?.responseText || resp?.errorMessage || resp?.declineMessage || resp?.gatewayMessage || null;
}

function ResendReceiptSection({
  payment,
  customers,
  sendReceiptMutation,
}: {
  payment: Payment;
  customers: Customer[] | undefined;
  sendReceiptMutation: ReturnType<typeof useMutation<unknown, Error, { paymentId: string; email: string }>>;
}) {
  const customer = customers?.find((c) => c.id === payment.customerId);
  const defaultEmail = customer?.email || "";
  const [email, setEmail] = useState(defaultEmail);

  useEffect(() => {
    setEmail(defaultEmail);
  }, [defaultEmail, payment.id]);

  return (
    <div className="border-t pt-4 mt-2">
      <p className="text-sm font-medium mb-2 flex items-center gap-2">
        <Mail className="h-4 w-4" /> Resend Receipt
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="Recipient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-resend-receipt-email"
        />
        <Button
          size="default"
          variant="outline"
          disabled={!email || sendReceiptMutation.isPending}
          onClick={() => sendReceiptMutation.mutate({ paymentId: payment.id, email })}
          data-testid="button-resend-receipt"
        >
          {sendReceiptMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="ml-2">Send</span>
        </Button>
      </div>
    </div>
  );
}

function resolveCustomerName(payment: Payment, customers: Customer[] | undefined): { name: string; company: string | null } {
  if (!payment.customerId) return { name: "—", company: null };
  const customer = customers?.find(c => c.id === payment.customerId);
  if (!customer) return { name: payment.customerId.slice(0, 8), company: null };
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.companyName || customer.accountNumber || "—";
  const company = (customer.companyName && customer.companyName !== name) ? customer.companyName : null;
  return { name, company };
}

function resolvePaymentMethod(payment: Payment): { primary: string; secondary: string | null } {
  const type = payment.tenderType || "unknown";
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  if ((type === "card" || type === "credit" || type === "debit") && payment.cardBrand && payment.cardLast4) {
    return { primary: label, secondary: `${payment.cardBrand} ••••${payment.cardLast4}` };
  }
  if (type === "check" && payment.checkNumber) {
    return { primary: "Check", secondary: `#${payment.checkNumber}` };
  }
  if (type === "ach") {
    return { primary: "ACH", secondary: payment.cardLast4 ? `••••${payment.cardLast4}` : null };
  }
  return { primary: label, secondary: null };
}

function resolvePaymentMethodShort(payment: Payment): string {
  const type = payment.tenderType || "unknown";
  if ((type === "card" || type === "credit" || type === "debit") && payment.cardLast4) {
    return `${payment.cardBrand || "Card"} ••${payment.cardLast4}`;
  }
  if (type === "ach" && payment.cardLast4) return `ACH ••${payment.cardLast4}`;
  if (type === "check") return payment.checkNumber ? `Check #${payment.checkNumber}` : "Check";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getSourceLabel(sourceType: string): string {
  return SOURCE_CONFIG[sourceType]?.label || "Unknown";
}

function MobileTransactionCard({
  payment,
  customers,
  onSelect,
}: {
  payment: EnrichedPayment;
  customers: Customer[] | undefined;
  onSelect: () => void;
}) {
  const { name } = resolveCustomerName(payment, customers);
  const methodShort = resolvePaymentMethodShort(payment);
  const status = payment.status || "pending";
  const isDeclined = status === "declined";
  const isException = isDeclined || status === "voided";
  const declineReason = isDeclined ? getDeclineReason(payment) : null;

  return (
    <button
      type="button"
      className={`w-full text-left px-4 py-3 border-b last:border-b-0 active:bg-muted/60 transition-colors ${isException ? "bg-muted/20" : ""}`}
      onClick={onSelect}
      data-testid={`row-transaction-${payment.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AmountCell payment={payment} />
          <StatusBadge status={status} />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
      </div>

      {isDeclined && declineReason && (
        <p className="text-[11px] leading-tight text-destructive/80 mt-1 line-clamp-1" data-testid={`text-decline-mobile-${payment.id}`}>
          {declineReason}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <SourceInline sourceType={payment.sourceType || "unknown"} sourceRef={payment.sourceRef} />
        {name !== "—" && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
        <span className="capitalize">{methodShort}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>{formatDateCompact(payment.paymentDate || payment.createdAt)}</span>
      </div>
    </button>
  );
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tenderFilter, setTenderFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<EnrichedPayment | null>(null);
  const [refundPayment, setRefundPayment] = useState<EnrichedPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    apiRequest("POST", "/api/mx/sync/transactions")
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/payments"] }))
      .catch(() => {});
  }, []);

  const { data: payments, isLoading } = useQuery<EnrichedPayment[]>({
    queryKey: ["/api/payments", { enrich: "source" }],
    queryFn: async () => {
      const res = await fetch("/api/payments?enrich=source");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"]
  });

  const voidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest("POST", `/api/mx/payments/${paymentId}/void`) as unknown as { success: boolean; message?: string };
      if (response && response.success === false) throw new Error(response.message || "Void failed");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Payment voided", description: "The payment has been voided via MX Merchant." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to void the payment.";
      toast({
        title: "Void failed",
        description: msg.includes("No active MX credentials")
          ? "Please configure MX Merchant API credentials first."
          : msg.includes("no MX reference")
          ? "This payment cannot be voided (processed without MX Merchant)."
          : msg,
        variant: "destructive"
      });
    }
  });

  const refundMutation = useMutation({
    mutationFn: async ({ paymentId, amount }: { paymentId: string; amount?: number }) => {
      const body: Record<string, any> = {};
      if (amount !== undefined) body.amount = amount;
      const res = await apiRequest("POST", `/api/mx/payments/${paymentId}/refund`, body);
      const response = await (res as any).json() as { success: boolean; message?: string };
      if (!response.success) throw new Error(response.message || "Refund failed");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setRefundPayment(null);
      setRefundAmount("");
      toast({ title: "Payment refunded", description: "The refund has been processed successfully." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to process refund.";
      toast({
        title: "Refund failed",
        description: msg.includes("No active MX credentials")
          ? "Please configure MX Merchant API credentials first."
          : msg.includes("no MX reference")
          ? "This payment cannot be refunded (processed without MX Merchant)."
          : msg,
        variant: "destructive"
      });
    }
  });

  const sendReceiptMutation = useMutation({
    mutationFn: async ({ paymentId, email }: { paymentId: string; email: string }) => {
      return apiRequest("POST", `/api/payments/${paymentId}/receipt`, { email });
    },
    onSuccess: () => {
      toast({ title: "Receipt sent", description: "The receipt has been sent successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send the receipt.", variant: "destructive" });
    }
  });

  const filteredPayments = useMemo(() => {
    return (payments || []).filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter) return false;
      if (tenderFilter !== "all" && payment.tenderType !== tenderFilter) return false;
      if (sourceFilter !== "all" && payment.sourceType !== sourceFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const ref = payment.referenceNumber?.toLowerCase() || "";
        const amt = payment.amount?.toString() || "";
        const card = payment.cardLast4 || "";
        const auth = payment.authCode?.toLowerCase() || "";
        const { name } = resolveCustomerName(payment, customers);
        const nameL = name.toLowerCase();
        const srcRef = payment.sourceRef?.toLowerCase() || "";
        const srcLabel = getSourceLabel(payment.sourceType || "unknown").toLowerCase();
        if (!ref.includes(s) && !amt.includes(s) && !card.includes(s) && !auth.includes(s) && !nameL.includes(s) && !srcRef.includes(s) && !srcLabel.includes(s)) return false;
      }
      return true;
    });
  }, [payments, search, statusFilter, tenderFilter, sourceFilter, customers]);

  const activeFilterCount = [statusFilter, tenderFilter, sourceFilter].filter(f => f !== "all").length;

  const exportCSV = () => {
    const headers = ["Reference", "Customer", "Source", "Linked Record", "Status", "Amount", "Payment Method", "Date", "Auth Code"];
    const rows = filteredPayments.map((p) => {
      const { name } = resolveCustomerName(p, customers);
      const { primary, secondary } = resolvePaymentMethod(p);
      return [
        p.referenceNumber || p.id.slice(0, 8).toUpperCase(),
        name,
        getSourceLabel(p.sourceType || "unknown"),
        p.sourceRef || "",
        p.status || "",
        p.amount || "0",
        secondary ? `${primary} ${secondary}` : primary,
        formatDateShort(p.paymentDate || p.createdAt),
        p.authCode || ""
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight" data-testid="text-page-title">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All payment activity across your account</p>
      </div>

      {/* Desktop control bar */}
      <div className="hidden md:flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-transaction-count">
          {isLoading ? "Loading..." : `${filteredPayments.length} ${filteredPayments.length === 1 ? "transaction" : "transactions"}`}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ref, customer, source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-60 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tenderFilter} onValueChange={setTenderFilter}>
            <SelectTrigger className="h-8 w-[120px] text-sm" data-testid="select-tender">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="ach">ACH</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="check">Check</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-8 w-[120px] text-sm" data-testid="select-source">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="shop_agent">Shop Agent</SelectItem>
              <SelectItem value="shop_customer">Shop Customer</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
              <SelectItem value="quick_payment">Quick Pay</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={exportCSV} data-testid="button-export">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Mobile control bar */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-testid="input-search-mobile"
            />
          </div>
          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            data-testid="button-mobile-filters"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
          </Button>
          <Button variant="outline" size="sm" className="h-9 px-2.5 shrink-0" onClick={exportCSV} data-testid="button-export-mobile">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showMobileFilters && (
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs" data-testid="select-status-mobile">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tenderFilter} onValueChange={setTenderFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="select-tender-mobile">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs" data-testid="select-source-mobile">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="shop_agent">Shop Agent</SelectItem>
                <SelectItem value="shop_customer">Shop Customer</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="quick_payment">Quick Pay</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStatusFilter("all"); setTenderFilter("all"); setSourceFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>
        )}
        <div className="text-xs text-muted-foreground tabular-nums" data-testid="text-transaction-count-mobile">
          {isLoading ? "Loading..." : `${filteredPayments.length} ${filteredPayments.length === 1 ? "transaction" : "transactions"}`}
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <ArrowUpDown className="h-9 w-9 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {(payments || []).length === 0 ? "No transactions yet" : "No transactions match your filters"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(payments || []).length === 0
                    ? "Transactions will appear here as payments are processed."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Reference</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Customer</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Source</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Payment Method</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase text-right pr-4">Amount</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => {
                  const { name, company } = resolveCustomerName(payment, customers);
                  const { primary, secondary } = resolvePaymentMethod(payment);
                  const isException = payment.status === "declined" || payment.status === "voided";

                  return (
                    <TableRow
                      key={payment.id}
                      className={`cursor-pointer hover-elevate${isException ? " bg-muted/20" : ""}`}
                      onClick={() => setSelectedPayment(payment)}
                      data-testid={`row-transaction-${payment.id}`}
                    >
                      <TableCell className="pl-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-sm font-medium leading-snug" data-testid={`text-ref-${payment.id}`}>
                            {payment.referenceNumber || payment.id.slice(0, 8).toUpperCase()}
                          </span>
                          {payment.authCode && (
                            <span className="text-[11px] text-muted-foreground/60 leading-tight font-mono">
                              Auth: {payment.authCode}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm leading-snug" data-testid={`text-customer-${payment.id}`}>{name}</span>
                          {company && (
                            <span className="text-[11px] text-muted-foreground/70 leading-tight truncate">{company}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <SourceBadge sourceType={payment.sourceType || "unknown"} sourceRef={payment.sourceRef} />
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm leading-snug capitalize">{primary}</span>
                          {secondary && (
                            <span className="text-[11px] text-muted-foreground/70 leading-tight">{secondary}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={payment.status || "pending"} />
                          {payment.status === "declined" && (() => {
                            const msg = getDeclineReason(payment);
                            return msg ? (
                              <span className="text-[11px] text-destructive leading-tight">
                                {msg.slice(0, 40)}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>

                      <TableCell className="text-right pr-4">
                        <AmountCell payment={payment} />
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateShort(payment.paymentDate || payment.createdAt)}
                        </span>
                      </TableCell>

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-actions-${payment.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setSelectedPayment(payment); }}
                              data-testid={`menu-view-${payment.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {(payment.status === "approved" || payment.status === "settled") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    voidMutation.mutate(payment.id);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`menu-void-${payment.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Void
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRefundPayment(payment);
                                    setRefundAmount(parseFloat(payment.amount || "0").toFixed(2));
                                  }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`menu-refund-${payment.id}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Refund
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <Card className="md:hidden overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
              <ArrowUpDown className="h-8 w-8 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {(payments || []).length === 0 ? "No transactions yet" : "No matches"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(payments || []).length === 0
                    ? "Transactions will appear here as payments are processed."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {filteredPayments.map((payment) => (
                <MobileTransactionCard
                  key={payment.id}
                  payment={payment}
                  customers={customers}
                  onSelect={() => setSelectedPayment(payment)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund dialog */}
      <Dialog
        open={!!refundPayment}
        onOpenChange={(open) => { if (!open) { setRefundPayment(null); setRefundAmount(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              Ref: {refundPayment?.referenceNumber || refundPayment?.id.slice(0, 8).toUpperCase()} · {formatCurrency(refundPayment?.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Original Amount</span>
              <span className="font-medium">{formatCurrency(refundPayment?.amount || "0")}</span>
            </div>
            <div className="space-y-2">
              <label htmlFor="refund-amount" className="text-sm font-medium">Refund Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="refund-amount"
                  data-testid="input-refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundPayment?.amount || "0"}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              {refundAmount && parseFloat(refundAmount) < parseFloat(refundPayment?.amount || "0") && (
                <p className="text-xs text-muted-foreground">
                  Partial refund: {formatCurrency(refundAmount)} of {formatCurrency(refundPayment?.amount || "0")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRefundPayment(null); setRefundAmount(""); }}
              data-testid="button-cancel-refund"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-refund"
              disabled={
                refundMutation.isPending ||
                !refundAmount ||
                isNaN(parseFloat(refundAmount)) ||
                parseFloat(refundAmount) <= 0 ||
                parseFloat(refundAmount) > parseFloat(refundPayment?.amount || "0")
              }
              onClick={() => {
                if (!refundPayment) return;
                const amt = parseFloat(refundAmount);
                const originalAmt = parseFloat(refundPayment.amount || "0");
                if (isNaN(amt) || amt <= 0) return;
                refundMutation.mutate({ paymentId: refundPayment.id, amount: amt < originalAmt ? amt : undefined });
              }}
            >
              {refundMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><RotateCcw className="h-4 w-4 mr-2" />Process Refund</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedPayment?.referenceNumber || selectedPayment?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (() => {
            const { name } = resolveCustomerName(selectedPayment, customers);
            const { primary, secondary } = resolvePaymentMethod(selectedPayment);
            const declineReason = getDeclineReason(selectedPayment);
            const isDeclined = selectedPayment.status === "declined";
            const srcConfig = SOURCE_CONFIG[selectedPayment.sourceType || "unknown"] || SOURCE_CONFIG.unknown;
            const SrcIcon = srcConfig.icon;
            const linkedRecordLabel = selectedPayment.sourceRef
              ? (selectedPayment.sourceType === "order" || selectedPayment.sourceType === "shop_agent" || selectedPayment.sourceType === "shop_customer") ? `Order #${selectedPayment.sourceRef}`
              : selectedPayment.sourceType === "invoice" ? `Invoice ${selectedPayment.sourceRef}`
              : selectedPayment.sourceType === "recurring" ? selectedPayment.sourceRef
              : selectedPayment.sourceRef
              : null;

            return (
              <div className="space-y-4">
                {isDeclined ? (
                  <>
                    <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3" data-testid="section-decline-reason">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-destructive/10 p-1.5">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-destructive">Declined</p>
                            <p className="text-lg font-bold tabular-nums text-muted-foreground line-through">{formatCurrency(selectedPayment.amount)}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">{formatDateShort(selectedPayment.paymentDate || selectedPayment.createdAt)}</span>
                      </div>

                      {declineReason && (
                        <div className="rounded-md bg-destructive/10 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-destructive/70 mb-0.5">Decline Reason</p>
                          <p className="text-sm font-medium text-destructive" data-testid="text-decline-reason">{declineReason}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Source</p>
                          <p className={`text-sm font-medium flex items-center gap-1.5 ${srcConfig.color}`}>
                            <SrcIcon className="h-3.5 w-3.5" />
                            {srcConfig.label}
                          </p>
                        </div>
                        {linkedRecordLabel && (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Linked Record</p>
                            <p className="text-sm font-medium font-mono" data-testid="text-detail-source-ref">{linkedRecordLabel}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Customer</p>
                          <p className="text-sm font-medium">{name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Payment Method</p>
                          <p className="text-sm capitalize">{primary}</p>
                          {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {selectedPayment.authCode && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Auth Code</p>
                          <p className="text-sm font-mono">{selectedPayment.authCode}</p>
                        </div>
                      )}
                      {selectedPayment.referenceNumber && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Reference</p>
                          <p className="text-sm font-mono">{selectedPayment.referenceNumber}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Date</p>
                        <p className="text-sm">{formatDate(selectedPayment.paymentDate || selectedPayment.createdAt)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Amount</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(selectedPayment.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Status</p>
                        <StatusBadge status={selectedPayment.status || "pending"} />
                      </div>
                    </div>

                    {(selectedPayment as any).adjustmentAmount && parseFloat((selectedPayment as any).adjustmentAmount) > 0 && (
                      <div className="flex items-center justify-between px-4 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="section-adjustment">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{(selectedPayment as any).adjustmentLabel || "Price Adjustment"}</span>
                        <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">+{formatCurrency((selectedPayment as any).adjustmentAmount)}</span>
                      </div>
                    )}

                    <div className="rounded-md border px-3 py-2.5" data-testid="section-source">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Source</p>
                          <p className={`text-sm font-medium flex items-center gap-1.5 ${srcConfig.color}`}>
                            <SrcIcon className="h-3.5 w-3.5" />
                            {srcConfig.label}
                          </p>
                        </div>
                        {linkedRecordLabel && (
                          <div className="text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Linked Record</p>
                            <p className="text-sm font-medium font-mono" data-testid="text-detail-source-ref">{linkedRecordLabel}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Customer</p>
                        <p className="text-sm font-medium">{name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Date</p>
                        <p className="text-sm">{formatDate(selectedPayment.paymentDate || selectedPayment.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Payment Method</p>
                        <p className="text-sm capitalize">{primary}</p>
                        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
                      </div>
                      {selectedPayment.authCode && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Auth Code</p>
                          <p className="text-sm font-mono">{selectedPayment.authCode}</p>
                        </div>
                      )}
                      {selectedPayment.referenceNumber && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Reference</p>
                          <p className="text-sm font-mono">{selectedPayment.referenceNumber}</p>
                        </div>
                      )}
                      {selectedPayment.batchId && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Batch ID</p>
                          <p className="text-sm font-mono text-muted-foreground">{selectedPayment.batchId}</p>
                        </div>
                      )}
                      {selectedPayment.tipAmount && parseFloat(selectedPayment.tipAmount) > 0 && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Tip</p>
                          <p className="text-sm">{formatCurrency(selectedPayment.tipAmount)}</p>
                        </div>
                      )}
                      {selectedPayment.surchargeAmount && parseFloat(selectedPayment.surchargeAmount) > 0 && (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Surcharge</p>
                          <p className="text-sm">{formatCurrency(selectedPayment.surchargeAmount)}</p>
                        </div>
                      )}
                    </div>

                    {(selectedPayment.status === "approved" || selectedPayment.status === "settled") && (
                      <ResendReceiptSection
                        payment={selectedPayment}
                        customers={customers}
                        sendReceiptMutation={sendReceiptMutation}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
