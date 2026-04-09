import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Download,
  Truck,
  MapPin,
  Mail,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Ban,
  Hash,
  Save,
  ArrowRight,
  BanknoteIcon,
  FileSignature,
  RefreshCw,
  Pencil,
  X,
  Plus,
  MoreHorizontal,
  User,
  Loader2,
  Tag,
} from "lucide-react";
import type { Order, OrderItem } from "@shared/schema";
import { FeatureNotEnabled } from "@/components/feature-not-enabled";
import { NewCustomerDialog } from "@/components/new-customer-dialog";

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

const formatShippingAddress = (addr: any): string => {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  const parts: string[] = [];
  if (addr.street) parts.push(addr.street);
  const cityLine: string[] = [];
  if (addr.city) cityLine.push(addr.city);
  if (addr.state) cityLine.push(addr.state);
  if (cityLine.length > 0) {
    let line = cityLine.join(", ");
    if (addr.zip) line += " " + addr.zip;
    parts.push(line);
  } else if (addr.zip) {
    parts.push(addr.zip);
  }
  return parts.join("\n");
};

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));

const formatDateShort = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const normalizeOrderStatus = (status: string | null): "pending" | "completed" | "cancelled" => {
  switch (status) {
    case "pending": return "pending";
    case "cancelled": return "cancelled";
    case "completed":
    case "confirmed":
    case "processing":
    case "shipped":
    case "delivered":
    case "refunded":
    case "returned": return "completed";
    default: return "pending";
  }
};

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

const sourceLabel = (source: string | null) => {
  switch (source) {
    case "customer_portal": return "Customer Portal";
    case "agent_portal": return "Agent Portal";
    case "pos": return "POS";
    default: return source || "Manual";
  }
};

type OrderItemWithInventory = OrderItem & {
  trackSerialNumbers?: boolean;
  availableSerials?: { id: string; serialNumber: string }[];
};

type OrderWithItems = Order & { items?: OrderItemWithInventory[] };

function StatusBadge({ status }: { status: "pending" | "completed" | "cancelled" }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 font-normal">
        Pending
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 font-normal">
        Completed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground font-normal">
      Cancelled
    </Badge>
  );
}

export default function OrdersPage() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [isEditingTracking, setIsEditingTracking] = useState(false);

  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);
  const [statusDialog, setStatusDialog] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const [serialAssignments, setSerialAssignments] = useState<Record<string, string>>({});

  const [resendEmailOrder, setResendEmailOrder] = useState<Order | null>(null);
  const [resendOverrideEmail, setResendOverrideEmail] = useState("");

  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);

  const isEnabled = tenant?.onlineStoreEnabled || tenant?.mxOrdersEnabled;

  if (!isEnabled) {
    return (
      <FeatureNotEnabled
        title="Shop Orders Not Available"
        description="Track and manage customer orders from your online store."
        featureName="Online Store"
      />
    );
  }

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"]
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    enabled: editingCustomer,
  });

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customers.filter((c: any) => {
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      const company = (c.company || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const account = (c.accountNumber || "").toLowerCase();
      return fullName.includes(q) || company.includes(q) || email.includes(q) || account.includes(q);
    }).slice(0, 10);
  }, [customers, customerSearch]);

  const filteredOrders = (orders || []).filter(order => {
    const o = order as any;
    const s = search.toLowerCase();
    const matchesSearch = !search ||
      order.orderNumber?.toLowerCase().includes(s) ||
      order.customerName?.toLowerCase().includes(s) ||
      order.customerEmail?.toLowerCase().includes(s) ||
      o.customerAccountNumber?.toLowerCase().includes(s) ||
      o.customerCompany?.toLowerCase().includes(s) ||
      o.agentName?.toLowerCase().includes(s) ||
      order.trackingNumber?.toLowerCase().includes(s);
    const matchesStatus = statusFilter === "all" || normalizeOrderStatus(order.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = useMemo(() => ({
    total: (orders || []).length,
    pending: (orders || []).filter(o => normalizeOrderStatus(o.status) === "pending").length,
    completed: (orders || []).filter(o => normalizeOrderStatus(o.status) === "completed").length,
    totalRevenue: (orders || []).reduce((sum, o) => sum + parseFloat(o.totalAmount), 0)
  }), [orders]);

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}`, updates);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      if (selectedOrder && selectedOrder.id === data.id) {
        setSelectedOrder(prev => prev ? { ...prev, ...data } : null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const assignSerialMutation = useMutation({
    mutationFn: async ({ orderId, itemId, serialNumber }: { orderId: string; itemId: string; serialNumber: string }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/items/${itemId}/assign-serial`, { serialNumber });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Serial number assigned", description: "The serial number has been marked as sold in inventory tracking." });
      setSerialAssignments(prev => {
        const next = { ...prev };
        delete next[variables.itemId];
        return next;
      });
      if (selectedOrder) handleViewOrder(selectedOrder);
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/sold-items"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const resendEmailMutation = useMutation({
    mutationFn: async ({ orderId, overrideEmail }: { orderId: string; overrideEmail?: string }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/resend-email`, overrideEmail ? { overrideEmail } : {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Email Sent", description: data.message || "Order email has been resent." });
      setResendEmailOrder(null);
      setResendOverrideEmail("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to Send", description: error.message || "Could not send the email.", variant: "destructive" });
    }
  });

  const handleViewOrder = async (order: Order) => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        fetch(`/api/orders/${order.id}`, { credentials: "include" }),
        fetch(`/api/orders/${order.id}/items-inventory`, { credentials: "include" })
      ]);
      const orderData = await orderRes.json();
      const itemsData = await itemsRes.json();
      setSelectedOrder({ ...orderData, items: itemsData });
      setTrackingNumber(orderData.trackingNumber || "");
      setTrackingCarrier(orderData.trackingCarrier || "");
      setIsEditingTracking(false);
      setSerialAssignments({});
      setActiveTab("details");
    } catch {
      setSelectedOrder({ ...order, items: [] });
    }
  };

  const handleCancelOrder = () => {
    if (!cancelDialog) return;
    updateOrderMutation.mutate(
      { id: cancelDialog.id, updates: { status: "cancelled", paymentStatus: "refunded" } },
      {
        onSuccess: () => {
          setCancelDialog(null);
          toast({ title: "Order cancelled & refunded", description: `Order ${cancelDialog.orderNumber} has been cancelled and refunded.` });
        }
      }
    );
  };

  const handleUpdateStatus = () => {
    if (!statusDialog || !newStatus) return;
    updateOrderMutation.mutate(
      { id: statusDialog.id, updates: { status: newStatus } },
      {
        onSuccess: () => {
          setStatusDialog(null);
          toast({ title: "Status updated", description: `Order status changed to ${newStatus}.` });
        }
      }
    );
  };

  const handleSaveTracking = () => {
    if (!selectedOrder) return;
    updateOrderMutation.mutate(
      { id: selectedOrder.id, updates: { trackingNumber, trackingCarrier, status: "completed" } },
      {
        onSuccess: () => {
          setIsEditingTracking(false);
          toast({ title: "Tracking updated", description: "Tracking information saved and order marked as completed." });
        }
      }
    );
  };

  const handleAssignSerial = (orderId: string, itemId: string) => {
    const serialNumber = serialAssignments[itemId];
    if (!serialNumber) return;
    assignSerialMutation.mutate({ orderId, itemId, serialNumber });
  };

  const openStatusDialog = (order: Order) => {
    setStatusDialog(order);
    setNewStatus(normalizeOrderStatus(order.status));
  };

  const exportCsv = () => {
    const csvData = filteredOrders.map(o => ({
      "Order #": o.orderNumber,
      Customer: o.customerName || "",
      Email: o.customerEmail || "",
      "Account #": (o as any).customerAccountNumber || "",
      "Location DBA": (o as any).customerCompany || "",
      "Sales Agent": (o as any).agentName || "",
      Status: o.status,
      Subtotal: o.subtotal,
      "Promo Code": (o as any).promoUse?.code || "",
      "Promo Discount": (o as any).promoUse?.discountAmount || "",
      Tax: o.taxAmount,
      Total: o.totalAmount,
      Tracking: o.trackingNumber || "",
      Carrier: o.trackingCarrier || "",
      Source: sourceLabel(o.source),
      Date: formatDate(o.createdAt)
    }));
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(","),
      ...csvData.map(row => headers.map(h => `"${(row as any)[h] || ""}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canCancel = (order: Order) => order.status !== "cancelled";
  const hasSerialItems = selectedOrder?.items?.some(i => i.trackSerialNumbers) || false;
  const tabCount = hasSerialItems ? 3 : 2;

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Shop Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage online store orders and fulfillment</p>
      </div>

      {/* Metrics strip */}
      {!isLoading && (
        <div className="flex items-center gap-5 text-sm flex-wrap" data-testid="metrics-strip">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tabular-nums" data-testid="text-total-orders">{stats.total}</span>
            <span className="text-muted-foreground">orders</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums text-amber-600" data-testid="text-pending-orders">{stats.pending}</span>
            <span className="text-muted-foreground">pending</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums text-emerald-600" data-testid="text-completed-orders">{stats.completed}</span>
            <span className="text-muted-foreground">completed</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tabular-nums" data-testid="text-total-revenue">{formatCurrency(stats.totalRevenue)}</span>
            <span className="text-muted-foreground">revenue</span>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-order-count">
          {isLoading ? "Loading..." : `${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"}`}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search orders, customers, tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-64 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={exportCsv} data-testid="button-export">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : (orders || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <Truck className="h-9 w-9 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No orders yet</p>
                <p className="text-sm text-muted-foreground">Orders placed through your online store will appear here.</p>
              </div>
            </div>
          ) : (
            <Table data-testid="table-orders">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Order</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Customer</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Source</TableHead>
                  <TableHead className="text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Total</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Fulfillment</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      No orders match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.map((order) => {
                  const o = order as any;
                  const status = normalizeOrderStatus(order.status);

                  const customerSecondary =
                    (o.customerAccountNumber && o.customerCompany)
                      ? `${o.customerAccountNumber} · ${o.customerCompany}`
                      : o.customerAccountNumber
                      ? `Acct ${o.customerAccountNumber}`
                      : o.customerCompany
                      ? o.customerCompany
                      : order.customerEmail
                      ? order.customerEmail
                      : null;

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => handleViewOrder(order)}
                      data-testid={`row-order-${order.id}`}
                    >
                      {/* Order number + date */}
                      <TableCell className="pl-5 py-3">
                        <div className="flex flex-col">
                          <span
                            className="text-sm font-semibold leading-tight text-foreground"
                            data-testid={`text-order-number-${order.id}`}
                          >
                            {order.orderNumber}
                          </span>
                          <span className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
                            {formatDateShort(order.createdAt)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span
                            className="text-sm leading-tight"
                            data-testid={`text-customer-name-${order.id}`}
                          >
                            {order.customerName || <span className="text-muted-foreground italic">Walk-in</span>}
                          </span>
                          {customerSecondary && (
                            <span
                              className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5 truncate max-w-[200px]"
                              data-testid={`text-customer-secondary-${order.id}`}
                            >
                              {customerSecondary}
                            </span>
                          )}
                          {o.agentName && (
                            <span className="text-[11px] text-muted-foreground/50 leading-tight mt-0.5">
                              Agent: {o.agentName}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-muted-foreground font-normal text-[11px]"
                          data-testid={`badge-source-${order.id}`}
                        >
                          {sourceLabel(order.source)}
                        </Badge>
                      </TableCell>

                      {/* Total */}
                      <TableCell className="py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className="text-sm font-semibold tabular-nums"
                            data-testid={`text-total-${order.id}`}
                          >
                            {formatCurrency(order.totalAmount)}
                          </span>
                          {o.financingEnabled && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400">Financed</span>
                          )}
                          {(o as any).promoUse && (
                            <span
                              className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5"
                              data-testid={`text-promo-badge-${order.id}`}
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {(o as any).promoUse.code}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        <StatusBadge status={status} />
                      </TableCell>

                      {/* Fulfillment / Tracking */}
                      <TableCell className="py-3">
                        {order.trackingNumber ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span
                                className="text-xs font-mono leading-tight"
                                data-testid={`text-tracking-${order.id}`}
                              >
                                {order.trackingNumber}
                              </span>
                            </div>
                            {order.trackingCarrier && (
                              <span className="text-[11px] text-muted-foreground/70 capitalize pl-4.5">
                                {order.trackingCarrier}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No tracking</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              data-testid={`button-order-actions-${order.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleViewOrder(order)}
                              data-testid={`button-view-order-${order.id}`}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openStatusDialog(order)}
                              data-testid={`button-status-order-${order.id}`}
                            >
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Update Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setResendEmailOrder(order); setResendOverrideEmail(""); }}
                              data-testid={`button-resend-email-${order.id}`}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Resend Email
                            </DropdownMenuItem>
                            {canCancel(order) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setCancelDialog(order)}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`button-cancel-order-${order.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancel & Refund
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

      {/* ─────────────────────────────────────────────────────────
          Order Detail Dialog
      ───────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setEditingCustomer(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-detail-title">
              Order {selectedOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder && formatDate(selectedOrder.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Status + source badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={normalizeOrderStatus(selectedOrder.status)} />
                <Badge
                  variant="outline"
                  className="text-muted-foreground font-normal text-[11px]"
                  data-testid="badge-detail-source"
                >
                  {sourceLabel(selectedOrder.source)}
                </Badge>
                {selectedOrder.paymentStatus && (
                  <Badge variant="outline" className="text-muted-foreground font-normal text-[11px]">
                    Payment: {selectedOrder.paymentStatus}
                  </Badge>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={`grid w-full grid-cols-${tabCount}`}>
                  <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                  <TabsTrigger value="shipping" data-testid="tab-shipping">Shipping & Tracking</TabsTrigger>
                  {hasSerialItems && (
                    <TabsTrigger value="serials" data-testid="tab-serials">Serial Numbers</TabsTrigger>
                  )}
                </TabsList>

                {/* ── Details Tab ── */}
                <TabsContent value="details" className="space-y-4 mt-4">

                  {/* Customer + metadata grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2 col-span-2 sm:col-span-1">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground">Customer</p>
                          {!editingCustomer && (
                            <button
                              onClick={() => { setEditingCustomer(true); setCustomerSearch(""); }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              data-testid="button-edit-customer"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {editingCustomer ? (
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-1">
                              <Input
                                placeholder="Search customers..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                data-testid="input-customer-search"
                              />
                              <button
                                onClick={() => setEditingCustomer(false)}
                                className="text-muted-foreground hover:text-foreground p-1"
                                data-testid="button-cancel-edit-customer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="border rounded-md max-h-[160px] overflow-y-auto">
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b flex items-center gap-1.5 text-primary font-medium"
                                onClick={() => setShowNewCustomerDialog(true)}
                                data-testid="button-new-customer-order"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                New Customer
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b"
                                onClick={() => {
                                  updateOrderMutation.mutate({
                                    id: selectedOrder.id,
                                    updates: { customerId: null, customerName: null, customerEmail: null }
                                  });
                                  setEditingCustomer(false);
                                  toast({ title: "Customer Removed", description: "Order set to Walk-in." });
                                }}
                                data-testid="button-select-walkin"
                              >
                                <span className="text-muted-foreground italic">Walk-in (no customer)</span>
                              </button>
                              {filteredCustomers.map((c: any) => (
                                <button
                                  key={c.id}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-0"
                                  onClick={() => {
                                    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
                                    updateOrderMutation.mutate({
                                      id: selectedOrder.id,
                                      updates: { customerId: c.id, customerName: name, customerEmail: c.email || null }
                                    });
                                    setEditingCustomer(false);
                                    toast({ title: "Customer Updated", description: `Order assigned to ${name}.` });
                                  }}
                                  data-testid={`button-select-customer-${c.id}`}
                                >
                                  <p className="font-medium">{c.firstName} {c.lastName}</p>
                                  {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                                  {c.accountNumber && <p className="text-xs text-muted-foreground">Acct: {c.accountNumber}</p>}
                                  {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                                </button>
                              ))}
                              {filteredCustomers.length === 0 && customerSearch && (
                                <p className="px-3 py-2 text-sm text-muted-foreground">No customers found</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-medium">{selectedOrder.customerName || "Walk-in"}</p>
                        )}
                      </div>
                    </div>

                    {selectedOrder.customerEmail && !editingCustomer && (
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm">{selectedOrder.customerEmail}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ordered</p>
                        <p className="text-sm">{formatDate(selectedOrder.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Payment</p>
                        <p className="text-sm">{selectedOrder.paymentStatus || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shipping address */}
                  {selectedOrder.shippingAddress && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Shipping Address</p>
                          <p className="text-sm whitespace-pre-line" data-testid="text-shipping-address-summary">
                            {formatShippingAddress(selectedOrder.shippingAddress)}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Items */}
                  {selectedOrder.items && selectedOrder.items.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">Order Items</p>
                        <div className="space-y-2">
                          {selectedOrder.items.map((item: OrderItemWithInventory, idx: number) => (
                            <div key={item.id || idx} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{item.name}</p>
                                  {item.trackSerialNumbers && (
                                    <Badge variant="outline" className="text-xs">SN Tracked</Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                )}
                                {item.modifiers && (
                                  <p className="text-xs text-muted-foreground">
                                    Modifiers: {(() => {
                                      try { return JSON.parse(item.modifiers).map((m: any) => m.name).join(", "); }
                                      catch { return item.modifiers; }
                                    })()}
                                  </p>
                                )}
                                {item.customFields && (() => {
                                  try {
                                    const fields = JSON.parse(item.customFields);
                                    if (Array.isArray(fields) && fields.length > 0) {
                                      return (
                                        <div className="mt-1 space-y-0.5">
                                          {fields.map((f: any, fIdx: number) => (
                                            <p key={fIdx} className="text-xs text-muted-foreground" data-testid={`custom-field-${idx}-${fIdx}`}>
                                              <span className="font-medium">{f.name}:</span> {f.value}
                                            </p>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return null;
                                  } catch { return null; }
                                })()}
                                <p className="text-xs text-muted-foreground">
                                  {item.quantity} × {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                              <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Totals */}
                  <Separator />
                  {(() => {
                    const ordSubtotal = parseFloat((selectedOrder as any).subtotal || "0");
                    const ordTax = parseFloat((selectedOrder as any).taxAmount || "0");
                    const ordShipping = parseFloat((selectedOrder as any).shippingAmount || "0");
                    const ordTotal = parseFloat((selectedOrder as any).totalAmount || "0");
                    const ordDiscount = Math.round((ordSubtotal + ordTax + ordShipping - ordTotal) * 100) / 100;
                    const ordHasDiscount = ordDiscount > 0.005;
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(selectedOrder.subtotal)}</span>
                        </div>
                        {(selectedOrder as any).promoUse ? (
                          <div className="flex justify-between text-sm" data-testid="text-promo-discount-line">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Promo ({(selectedOrder as any).promoUse.code})
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              -{formatCurrency((selectedOrder as any).promoUse.discountAmount)}
                            </span>
                          </div>
                        ) : ordHasDiscount ? (
                          <div className="flex justify-between text-sm" data-testid="text-promo-discount-line">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Discount
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              -{formatCurrency(ordDiscount)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax</span>
                          <span>{formatCurrency(selectedOrder.taxAmount || 0)}</span>
                        </div>
                        {selectedOrder.shippingAmount && parseFloat(selectedOrder.shippingAmount) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Shipping</span>
                            <span>{formatCurrency(selectedOrder.shippingAmount)}</span>
                          </div>
                        )}
                        {(selectedOrder as any).adjustmentAmount && parseFloat((selectedOrder as any).adjustmentAmount) > 0 && (
                          <div className="flex justify-between text-sm" data-testid="text-adjustment-line">
                            <span className="text-amber-600 dark:text-amber-400">{(selectedOrder as any).adjustmentLabel || "Adjustment"}</span>
                            <span className="text-amber-600 dark:text-amber-400">+{formatCurrency((selectedOrder as any).adjustmentAmount)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-base font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Promo code metadata */}
                  {(selectedOrder as any).promoUse && (
                    <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 space-y-1">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Promo Code Applied
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          Code: <span className="font-mono font-semibold text-foreground" data-testid="text-promo-code">{(selectedOrder as any).promoUse.code}</span>
                        </span>
                        {(selectedOrder as any).promoUse.promoName && (
                          <span>Name: <span className="font-medium text-foreground">{(selectedOrder as any).promoUse.promoName}</span></span>
                        )}
                        <span>
                          Discount: <span className="font-medium text-emerald-600 dark:text-emerald-400" data-testid="text-promo-discount-amount">-{formatCurrency((selectedOrder as any).promoUse.discountAmount)}</span>
                          {(selectedOrder as any).promoUse.discountType === "percent" ? " (% off)" : " (fixed)"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Financing block */}
                  {selectedOrder.financingEnabled && (
                    <>
                      <Separator />
                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <BanknoteIcon className="h-4 w-4 text-blue-600" />
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400" data-testid="text-financing-label">
                            Financed Purchase
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Monthly Payment</p>
                            <p className="font-medium" data-testid="text-financing-monthly">{formatCurrency(selectedOrder.financingMonthlyAmount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Term</p>
                            <p className="font-medium" data-testid="text-financing-months">{selectedOrder.financingMonths} months</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Finance Charge/mo</p>
                            <p className="font-medium" data-testid="text-financing-charge">{formatCurrency(selectedOrder.financingChargeAmount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Financed</p>
                            <p className="font-medium" data-testid="text-financing-total">
                              {formatCurrency(parseFloat(selectedOrder.financingMonthlyAmount || "0") * (selectedOrder.financingMonths || 1))}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedOrder.financingAgreementId && (
                            <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900" data-testid="badge-financing-agreement">
                              <FileSignature className="h-3 w-3" />
                              Agreement Linked
                            </Badge>
                          )}
                          {selectedOrder.financingContractId && (
                            <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900" data-testid="badge-financing-contract">
                              <RefreshCw className="h-3 w-3" />
                              Recurring Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Notes */}
                  {selectedOrder.notes && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm">{selectedOrder.notes}</p>
                      </div>
                    </>
                  )}

                  {/* Action buttons */}
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStatusDialog(selectedOrder)}
                      data-testid="button-update-status-detail"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Update Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setResendEmailOrder(selectedOrder); setResendOverrideEmail(""); }}
                      data-testid="button-resend-email-detail"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Email
                    </Button>
                    {canCancel(selectedOrder) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelDialog(selectedOrder)}
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        data-testid="button-cancel-detail"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel & Refund
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* ── Shipping & Tracking Tab ── */}
                <TabsContent value="shipping" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Tracking Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedOrder.trackingNumber && !isEditingTracking ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                              <p className="text-xs text-muted-foreground">Carrier</p>
                              <p className="text-sm font-medium capitalize">{selectedOrder.trackingCarrier || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tracking Number</p>
                              <p className="text-sm font-mono font-medium">{selectedOrder.trackingNumber}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsEditingTracking(true)} data-testid="button-edit-tracking">
                              Edit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            <Label>Tracking Number</Label>
                            <Input
                              value={trackingNumber}
                              onChange={e => setTrackingNumber(e.target.value)}
                              placeholder="Enter tracking number"
                              data-testid="input-tracking-number"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Carrier</Label>
                            <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                              <SelectTrigger data-testid="select-carrier">
                                <SelectValue placeholder="Select carrier" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="usps">USPS</SelectItem>
                                <SelectItem value="ups">UPS</SelectItem>
                                <SelectItem value="fedex">FedEx</SelectItem>
                                <SelectItem value="dhl">DHL</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveTracking}
                              disabled={!trackingNumber || updateOrderMutation.isPending}
                              data-testid="button-save-tracking"
                            >
                              {updateOrderMutation.isPending
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                                : <><Save className="h-4 w-4 mr-2" />Save & Mark Completed</>
                              }
                            </Button>
                            {isEditingTracking && (
                              <Button variant="outline" onClick={() => setIsEditingTracking(false)}>Cancel</Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedOrder.shippingAddress && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Shipping Address
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-line" data-testid="text-shipping-address-detail">
                          {formatShippingAddress(selectedOrder.shippingAddress)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ── Serial Numbers Tab ── */}
                {hasSerialItems && (
                  <TabsContent value="serials" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Assign serial numbers to items in this order. Assigned serial numbers will be marked as sold in Inventory Tracking.
                    </p>
                    {selectedOrder.items?.filter(i => i.trackSerialNumbers).map((item, idx) => (
                      <Card key={item.id || idx}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            {item.name} (Qty: {item.quantity})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {item.availableSerials && item.availableSerials.length > 0 ? (
                            <div className="space-y-3">
                              <div className="grid gap-2">
                                <Label>Select Serial Number</Label>
                                <Select
                                  value={serialAssignments[item.id] || ""}
                                  onValueChange={(val) => setSerialAssignments(prev => ({ ...prev, [item.id]: val }))}
                                >
                                  <SelectTrigger data-testid={`select-serial-${item.id}`}>
                                    <SelectValue placeholder="Choose an available serial number" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.availableSerials.map(sn => (
                                      <SelectItem key={sn.id} value={sn.serialNumber}>
                                        {sn.serialNumber}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                onClick={() => handleAssignSerial(selectedOrder.id, item.id)}
                                disabled={!serialAssignments[item.id] || assignSerialMutation.isPending}
                                data-testid={`button-assign-serial-${item.id}`}
                              >
                                {assignSerialMutation.isPending
                                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assigning...</>
                                  : <><CheckCircle className="h-4 w-4 mr-2" />Assign Serial Number</>
                                }
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No available serial numbers for this item. Add serial numbers in Inventory Manager first.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel & Refund confirmation */}
      <AlertDialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel & Refund Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel order <strong>{cancelDialog?.orderNumber}</strong> for {cancelDialog && formatCurrency(cancelDialog.totalAmount)}? This will cancel the order and process a refund.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel"
            >
              {updateOrderMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                : "Cancel & Refund"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Status dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>Order: {statusDialog?.orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={updateOrderMutation.isPending} data-testid="button-confirm-status">
              {updateOrderMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</>
                : "Update Status"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Email dialog */}
      <Dialog
        open={!!resendEmailOrder}
        onOpenChange={(open) => { if (!open) { setResendEmailOrder(null); setResendOverrideEmail(""); } }}
      >
        <DialogContent data-testid="dialog-resend-email">
          <DialogHeader>
            <DialogTitle>Resend Order Email</DialogTitle>
            <DialogDescription>
              Resend the order notification for #{resendEmailOrder?.orderNumber}.
              The email will match the current order status (
              {resendEmailOrder?.status === "completed" ? "Shipped/Completed" :
               resendEmailOrder?.status === "cancelled" ? "Cancelled/Refunded" :
               "Order Received"}).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Current Recipient</Label>
              <p className="text-sm text-muted-foreground" data-testid="text-current-email">
                {resendEmailOrder?.customerEmail || "No email on file"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="override-email">Send to Different Email (optional)</Label>
              <Input
                id="override-email"
                type="email"
                placeholder="Enter a new email address"
                value={resendOverrideEmail}
                onChange={(e) => setResendOverrideEmail(e.target.value)}
                data-testid="input-override-email"
              />
              <p className="text-xs text-muted-foreground">Leave blank to send to the original recipient.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResendEmailOrder(null); setResendOverrideEmail(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (resendEmailOrder) {
                  resendEmailMutation.mutate({
                    orderId: resendEmailOrder.id,
                    overrideEmail: resendOverrideEmail.trim() || undefined
                  });
                }
              }}
              disabled={resendEmailMutation.isPending}
              data-testid="button-confirm-resend"
            >
              {resendEmailMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                : <><Mail className="h-4 w-4 mr-2" />Send Email</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <NewCustomerDialog
          open={showNewCustomerDialog}
          onOpenChange={setShowNewCustomerDialog}
          onCustomerCreated={(customer) => {
            const name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
            updateOrderMutation.mutate({
              id: selectedOrder.id,
              updates: { customerId: customer.id, customerName: name, customerEmail: customer.email || null }
            });
            setEditingCustomer(false);
            setShowNewCustomerDialog(false);
            toast({ title: "Customer Created & Assigned", description: `Order assigned to ${name}.` });
          }}
        />
      )}
    </div>
  );
}
