import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, Link, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  User,
  FileText,
  CreditCard,
  RefreshCw,
  Wallet,
  Package,
  StickyNote,
  Calendar,
  DollarSign,
  Hash,
  Pencil,
  Loader2,
  Plus,
  Upload,
  Paperclip,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  MoreHorizontal,
  Eye,
  Send,
  Receipt,
  Ban,
  RotateCcw,
  Store,
  ShoppingBag,
  Trash2,
  Star,
  ArrowUpRight,
  Trophy,
  TrendingUp,
  Activity,
  Archive,
  AlertTriangle,
  Globe,
  Clock,
  UserCheck,
  Tag,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer, CustomerAddress, Invoice, Payment, Contract, InventorySerialNumber, CustomerNote, InvoiceAttachment, SalesAgent, Order, OrderItem } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-2 first:mt-0">
      {children}
    </p>
  );
}

const editCustomerSchema = z.object({
  salesOfficeAgent: z.string().optional(),
  accountNumber: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  legalCompanyName: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

type EditCustomerForm = z.infer<typeof editCustomerSchema>;

interface VaultedCard {
  id: string;
  token: string;
  cardBrand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  cardholderName: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
}

interface VaultedBank {
  id: string;
  bankName: string | null;
  accountType: string | null;
  last4: string | null;
  accountHolderName: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
}

interface PurchaseWithProduct extends InventorySerialNumber {
  itemName: string | null;
  itemDescription: string | null;
  itemPrice: string | null;
  quantity?: number;
  invoiceNumber?: string;
  orderNumber?: string;
  source?: "inventory" | "invoice" | "pos" | "store";
}

interface PromoUseInfo {
  code: string;
  promoName: string | null;
  discountAmount: string;
  discountType: string;
}

interface StoreOrderWithItems extends Order {
  items: OrderItem[];
  promoUse?: PromoUseInfo | null;
}

interface CustomerDetails {
  customer: Customer;
  addresses: CustomerAddress[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  vaultedCards: VaultedCard[];
  vaultedBanks: VaultedBank[];
  notes: CustomerNote[];
  purchases: PurchaseWithProduct[];
  attachments: InvoiceAttachment[];
  storeOrders: StoreOrderWithItems[];
}

const formatDate = (date: Date | string | null) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

const formatCurrency = (amount: string | number | null) => {
  if (amount === null || amount === undefined) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(num);
};

function InfoCell({ label, value, icon, testId }: { label: string; value: string | null | undefined; icon?: React.ReactNode; testId?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="font-medium text-sm leading-snug" data-testid={testId}>{value}</p>
    </div>
  );
}

const CREATION_SOURCE_LABELS: Record<string, string> = {
  manual: "Customer Portal",
  agent: "Agent Portal",
  mx_import: "MX Import",
};

function CustomerHeader({ customer, address }: { customer: Customer; address?: CustomerAddress }) {
  const initials = `${customer.firstName?.[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase() || "?";
  const fullAddress = address
    ? [address.address1, address.address2, address.city, address.state, address.postalCode].filter(Boolean).join(", ")
    : null;

  const createdByDisplay = (customer as any).createdByName
    || ((customer as any).creationSource === "mx_import" ? "System" : null);
  const sourceDisplay = (customer as any).creationSource
    ? CREATION_SOURCE_LABELS[(customer as any).creationSource] || (customer as any).creationSource
    : null;

  const updatedByDisplay: string | null = (customer as any).updatedByName || null;
  const updatedAtDisplay: string | null = (customer as any).updatedByName && (customer as any).updatedAt
    ? formatDate((customer as any).updatedAt)
    : null;

  const archivedByDisplay: string | null = (customer as any).archivedByName || null;
  const archivedAtDisplay: string | null = (customer as any).archivedAt
    ? formatDate((customer as any).archivedAt)
    : null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 shrink-0 mt-0.5">
            <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold leading-tight" data-testid="text-customer-name">
              {customer.firstName} {customer.lastName}
            </p>
            {(customer.company || customer.legalCompanyName) && (
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-dba">
                {customer.company}{customer.company && customer.legalCompanyName ? " · " : ""}{customer.legalCompanyName}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              {customer.accountNumber && (
                <InfoCell
                  label="Account #"
                  value={customer.accountNumber}
                  icon={<Hash className="h-3 w-3" />}
                  testId="text-account-number"
                />
              )}
              {customer.salesOfficeAgent && (
                <InfoCell
                  label="Sales Agent"
                  value={customer.salesOfficeAgent}
                  icon={<User className="h-3 w-3" />}
                  testId="text-sales-agent"
                />
              )}
              {customer.email && (
                <InfoCell
                  label="Email"
                  value={customer.email}
                  icon={<Mail className="h-3 w-3" />}
                  testId="text-email"
                />
              )}
              {customer.phone && (
                <InfoCell
                  label="Phone"
                  value={customer.phone}
                  icon={<Phone className="h-3 w-3" />}
                  testId="text-phone"
                />
              )}
              {fullAddress && (
                <InfoCell
                  label="Address"
                  value={fullAddress}
                  icon={<MapPin className="h-3 w-3" />}
                  testId="text-address"
                />
              )}
            </div>

            {(createdByDisplay || sourceDisplay || (customer as any).createdAt) && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {createdByDisplay && (
                    <InfoCell
                      label="Created By"
                      value={createdByDisplay}
                      icon={<UserCheck className="h-3 w-3" />}
                      testId="text-created-by"
                    />
                  )}
                  <InfoCell
                    label="Created On"
                    value={formatDate((customer as any).createdAt)}
                    icon={<Clock className="h-3 w-3" />}
                    testId="text-created-on"
                  />
                  {sourceDisplay && (
                    <InfoCell
                      label="Source"
                      value={sourceDisplay}
                      icon={<Globe className="h-3 w-3" />}
                      testId="text-creation-source"
                    />
                  )}
                  {updatedByDisplay && (
                    <InfoCell
                      label="Last Updated By"
                      value={updatedByDisplay}
                      icon={<Pencil className="h-3 w-3" />}
                      testId="text-updated-by"
                    />
                  )}
                  {updatedAtDisplay && (
                    <InfoCell
                      label="Last Updated On"
                      value={updatedAtDisplay}
                      icon={<Clock className="h-3 w-3" />}
                      testId="text-updated-on"
                    />
                  )}
                </div>
                {customer.isArchived && (archivedByDisplay || archivedAtDisplay) && (
                  <div className="flex flex-wrap gap-x-8 gap-y-2 pt-2 border-t border-dashed">
                    {archivedByDisplay && (
                      <InfoCell
                        label="Archived By"
                        value={archivedByDisplay}
                        icon={<Archive className="h-3 w-3" />}
                        testId="text-archived-by"
                      />
                    )}
                    {archivedAtDisplay && (
                      <InfoCell
                        label="Archived On"
                        value={archivedAtDisplay}
                        icon={<Clock className="h-3 w-3" />}
                        testId="text-archived-on"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  const { toast } = useToast();

  const resendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/resend`);
    },
    onSuccess: () => {
      toast({ title: "Invoice resent", description: "The invoice email has been resent to the customer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend invoice. Make sure the customer has an email address.", variant: "destructive" });
    }
  });

  const resendReceiptMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/resend-receipt`);
    },
    onSuccess: () => {
      toast({ title: "Receipt resent", description: "The payment receipt has been resent to the customer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend receipt.", variant: "destructive" });
    }
  });

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No invoices found for this customer</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <Card key={invoice.id} className="hover-elevate" data-testid={`card-invoice-${invoice.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link href={`/invoice/${invoice.id}`} className="flex flex-col flex-1 min-w-0 cursor-pointer" data-testid={`link-invoice-${invoice.id}`}>
                <p className="font-medium text-sm leading-snug">{invoice.invoiceNumber || `Invoice #${invoice.id.slice(0, 8)}`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(invoice.createdAt)}</p>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                {invoice.status === "paid" ? (
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal">Paid</Badge>
                ) : invoice.status === "overdue" ? (
                  <Badge variant="destructive">Overdue</Badge>
                ) : invoice.status === "sent" ? (
                  <Badge variant="outline" className="border-blue-300 text-blue-700 font-normal">Sent</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground font-normal capitalize">{invoice.status}</Badge>
                )}
                <span className="font-semibold text-sm w-20 text-right tabular-nums">{formatCurrency(invoice.totalAmount)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-invoice-actions-${invoice.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/invoice/${invoice.id}`} data-testid={`menu-view-invoice-${invoice.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Invoice
                      </Link>
                    </DropdownMenuItem>
                    {invoice.status !== "draft" && invoice.status !== "paid" && (
                      <DropdownMenuItem
                        onClick={() => resendInvoiceMutation.mutate(invoice.id)}
                        disabled={resendInvoiceMutation.isPending}
                        data-testid={`menu-resend-invoice-${invoice.id}`}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Resend Invoice
                      </DropdownMenuItem>
                    )}
                    {invoice.status === "paid" && (
                      <DropdownMenuItem
                        onClick={() => resendReceiptMutation.mutate(invoice.id)}
                        disabled={resendReceiptMutation.isPending}
                        data-testid={`menu-resend-receipt-${invoice.id}`}
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        Resend Receipt
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                      data-testid={`menu-download-pdf-${invoice.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PaymentsTab({ payments }: { payments: Payment[] }) {
  const { toast } = useToast();
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const resendPaymentReceiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return apiRequest("POST", `/api/payments/${paymentId}/receipt`);
    },
    onSuccess: () => {
      toast({ title: "Receipt resent", description: "The payment receipt has been resent to the customer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend receipt. Make sure the customer has an email address.", variant: "destructive" });
    }
  });

  const voidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest("POST", `/api/mx/payments/${paymentId}/void`) as unknown as { success: boolean; message?: string };
      if (response && response.success === false) {
        throw new Error(response.message || "Void failed");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Payment voided", description: "The payment has been successfully voided." });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to void the payment.";
      toast({
        title: "Void failed",
        description: message.includes("No active MX credentials")
          ? "Please configure MX Merchant API credentials first."
          : message.includes("no MX reference")
          ? "This payment cannot be voided (processed without MX Merchant)."
          : message,
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
      if (!response.success) {
        throw new Error(response.message || "Refund failed");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setRefundPayment(null);
      setRefundAmount("");
      toast({ title: "Payment refunded", description: "The refund has been processed successfully." });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to process refund.";
      toast({
        title: "Refund failed",
        description: message.includes("No active MX credentials")
          ? "Please configure MX Merchant API credentials first."
          : message.includes("no MX reference")
          ? "This payment cannot be refunded (processed without MX Merchant)."
          : message,
        variant: "destructive"
      });
    }
  });

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No payments found for this customer</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {payments.map((payment) => (
          <Card
            key={payment.id}
            className="hover-elevate cursor-pointer"
            data-testid={`card-payment-${payment.id}`}
            onClick={() => setSelectedPayment(payment)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">
                      {payment.tenderType === "cash" ? "CASH" :
                       payment.tenderType === "check" ? `CHECK${payment.checkNumber ? ` #${payment.checkNumber}` : ""}` :
                       `${(payment.tenderType || "CARD").toUpperCase()} •••• ${payment.cardLast4 || "****"}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(payment.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {payment.status === "approved" || payment.status === "settled" ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal capitalize">{payment.status}</Badge>
                  ) : payment.status === "declined" ? (
                    <Badge variant="destructive">Declined</Badge>
                  ) : payment.status === "voided" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal">Voided</Badge>
                  ) : payment.status === "refunded" ? (
                    <Badge variant="outline" className="border-blue-300 text-blue-700 font-normal">Refunded</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground font-normal capitalize">{payment.status}</Badge>
                  )}
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    data-testid={`button-view-payment-${payment.id}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedPayment(payment); }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" data-testid={`button-payment-actions-${payment.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(payment.status === "approved" || payment.status === "settled") && (
                        <DropdownMenuItem
                          onClick={() => resendPaymentReceiptMutation.mutate(payment.id)}
                          disabled={resendPaymentReceiptMutation.isPending}
                          data-testid={`menu-resend-payment-receipt-${payment.id}`}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          Resend Receipt
                        </DropdownMenuItem>
                      )}
                      {payment.status === "approved" && (
                        <DropdownMenuItem
                          onClick={() => voidMutation.mutate(payment.id)}
                          disabled={voidMutation.isPending}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-void-payment-${payment.id}`}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Void Payment
                        </DropdownMenuItem>
                      )}
                      {(payment.status === "approved" || payment.status === "settled") && (
                        <DropdownMenuItem
                          onClick={() => {
                            setRefundPayment(payment);
                            setRefundAmount(parseFloat(payment.amount || "0").toFixed(2));
                          }}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-refund-payment-${payment.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Refund Payment
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!refundPayment} onOpenChange={(open) => { if (!open) { setRefundPayment(null); setRefundAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              Process a refund for {refundPayment?.referenceNumber || refundPayment?.id.slice(0, 8).toUpperCase()}.
              Enter a partial amount or leave the full amount to refund the entire payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Original Amount</span>
              <span className="font-medium">{formatCurrency(refundPayment?.amount || "0")}</span>
            </div>
            <div className="space-y-2">
              <label htmlFor="customer-refund-amount" className="text-sm font-medium">Refund Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="customer-refund-amount"
                  data-testid="input-customer-refund-amount"
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
            <Button variant="outline" onClick={() => { setRefundPayment(null); setRefundAmount(""); }} data-testid="button-cancel-customer-refund">
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-customer-refund"
              disabled={refundMutation.isPending || !refundAmount || isNaN(parseFloat(refundAmount)) || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > parseFloat(refundPayment?.amount || "0")}
              onClick={() => {
                if (refundPayment) {
                  const amt = parseFloat(refundAmount);
                  const originalAmt = parseFloat(refundPayment.amount || "0");
                  if (isNaN(amt) || amt <= 0) return;
                  refundMutation.mutate({
                    paymentId: refundPayment.id,
                    amount: amt < originalAmt ? amt : undefined
                  });
                }
              }}
            >
              {refundMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedPayment?.referenceNumber || selectedPayment?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold tabular-nums" data-testid="text-payment-detail-amount">{formatCurrency(selectedPayment.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Status</p>
                  {selectedPayment.status === "approved" || selectedPayment.status === "settled" ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 capitalize">{selectedPayment.status}</Badge>
                  ) : selectedPayment.status === "declined" ? (
                    <Badge variant="destructive">Declined</Badge>
                  ) : selectedPayment.status === "voided" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">Voided</Badge>
                  ) : selectedPayment.status === "refunded" ? (
                    <Badge variant="outline" className="border-blue-300 text-blue-700">Refunded</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground capitalize">{selectedPayment.status}</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Date</p>
                  <p className="text-sm">{formatDate(selectedPayment.paymentDate || selectedPayment.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Payment Method</p>
                  <p className="text-sm capitalize">
                    {selectedPayment.tenderType === "cash" ? "Cash" :
                     selectedPayment.tenderType === "check" ? `Check${selectedPayment.checkNumber ? ` #${selectedPayment.checkNumber}` : ""}` :
                     selectedPayment.cardBrand && selectedPayment.cardLast4 ? `${selectedPayment.cardBrand} ••••${selectedPayment.cardLast4}` :
                     (selectedPayment.tenderType || "Card").toUpperCase()}
                  </p>
                </div>
                {selectedPayment.authCode && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Auth Code</p>
                    <p className="text-sm font-mono" data-testid="text-payment-auth-code">{selectedPayment.authCode}</p>
                  </div>
                )}
                {selectedPayment.referenceNumber && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Reference #</p>
                    <p className="text-sm font-mono" data-testid="text-payment-reference">{selectedPayment.referenceNumber}</p>
                  </div>
                )}
                {selectedPayment.batchId && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Batch ID</p>
                    <p className="text-sm font-mono text-muted-foreground">{selectedPayment.batchId}</p>
                  </div>
                )}
                {selectedPayment.invoiceId && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Invoice</p>
                    <p className="text-sm font-mono">{selectedPayment.invoiceId}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatFrequencyLabel(frequency: string): string {
  const map: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Bi-Weekly",
    semimonthly: "Semi-Monthly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually",
  };
  return map[frequency] || frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function RecurringTab({ contracts }: { contracts: Contract[] }) {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  if (contracts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No recurring payments found for this customer</p>
      </div>
    );
  }

  const lineItems = selectedContract?.lineItems as Array<{ name: string; price: string; description?: string }> | null | undefined;

  return (
    <>
      <div className="space-y-3">
        {contracts.map((contract) => (
          <Card
            key={contract.id}
            className="hover-elevate cursor-pointer"
            data-testid={`card-contract-${contract.id}`}
            onClick={() => setSelectedContract(contract)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <RefreshCw className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{contract.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFrequencyLabel(contract.frequency)}
                      {contract.nextPaymentDate ? ` • Next: ${formatDate(contract.nextPaymentDate)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {contract.status === "active" ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal">Active</Badge>
                  ) : contract.status === "paused" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal">Paused</Badge>
                  ) : contract.status === "failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : contract.status === "completed" ? (
                    <Badge variant="outline" className="text-muted-foreground font-normal">Completed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground font-normal capitalize">{contract.status}</Badge>
                  )}
                  <span className="font-medium">{formatCurrency(contract.amount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    data-testid={`button-view-contract-${contract.id}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedContract(contract); }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recurring Contract Detail Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => { if (!open) setSelectedContract(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContract?.name}</DialogTitle>
            <DialogDescription>
              {selectedContract ? formatFrequencyLabel(selectedContract.frequency) : ""}
              {selectedContract?.mxContractId ? ` · ${selectedContract.mxContractId}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              {/* Amount + Status hero */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold tabular-nums" data-testid="text-contract-detail-amount">{formatCurrency(selectedContract.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Status</p>
                  {selectedContract.status === "active" ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700">Active</Badge>
                  ) : selectedContract.status === "paused" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">Paused</Badge>
                  ) : selectedContract.status === "failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : selectedContract.status === "completed" ? (
                    <Badge variant="outline" className="text-muted-foreground">Completed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground capitalize">{selectedContract.status}</Badge>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Schedule</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Frequency</p>
                    <p className="text-sm" data-testid="text-contract-frequency">{formatFrequencyLabel(selectedContract.frequency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Start Date</p>
                    <p className="text-sm">{formatDate(selectedContract.startDate)}</p>
                  </div>
                  {selectedContract.nextPaymentDate && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Next Payment</p>
                      <p className="text-sm" data-testid="text-contract-next-payment">{formatDate(selectedContract.nextPaymentDate)}</p>
                    </div>
                  )}
                  {selectedContract.endDate && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">End Date</p>
                      <p className="text-sm">{formatDate(selectedContract.endDate)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              <Separator />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment Progress</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Payments Made</p>
                    <p className="text-sm font-semibold" data-testid="text-contract-payments-made">
                      {selectedContract.successfulPayments ?? 0}
                      {selectedContract.numberOfOccurrences ? ` / ${selectedContract.numberOfOccurrences}` : ""}
                    </p>
                  </div>
                  {selectedContract.numberOfOccurrences && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Remaining</p>
                      <p className="text-sm">
                        {Math.max(0, selectedContract.numberOfOccurrences - (selectedContract.successfulPayments ?? 0))}
                      </p>
                    </div>
                  )}
                  {!selectedContract.numberOfOccurrences && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Remaining</p>
                      <p className="text-sm text-muted-foreground">Ongoing</p>
                    </div>
                  )}
                  {(selectedContract.failedPayments ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Failed Attempts</p>
                      <p className="text-sm text-destructive">{selectedContract.failedPayments}</p>
                    </div>
                  )}
                  {(selectedContract.totalPayments ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Total Billed</p>
                      <p className="text-sm">{selectedContract.totalPayments}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              {lineItems && lineItems.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Line Items</p>
                    <div className="space-y-2">
                      {lineItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <p className="font-medium shrink-0">{formatCurrency(item.price)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Failure reason */}
              {selectedContract.lastFailureReason && (
                <>
                  <Separator />
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-destructive mb-0.5">Last Failure Reason</p>
                    <p className="text-sm text-destructive">{selectedContract.lastFailureReason}</p>
                  </div>
                </>
              )}

              {/* Linked agreement */}
              {selectedContract.agreementId && (
                <div className="bg-muted/40 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Linked Agreement</p>
                  <p className="text-sm font-mono text-muted-foreground">{selectedContract.agreementId}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const updateCardSchema = z.object({
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Expiry month must be 01-12"),
  expiryYear: z.string().regex(/^\d{4}$/, "Expiry year must be 4 digits"),
  name: z.string().min(2, "Cardholder name is required"),
  avsZip: z.string().optional(),
});

function PaymentMethodsTab({ cards, banks, customerId }: { cards: VaultedCard[]; banks: VaultedBank[]; customerId: string }) {
  const [editingCard, setEditingCard] = useState<VaultedCard | null>(null);
  const [deletingCard, setDeletingCard] = useState<VaultedCard | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof updateCardSchema>>({
    resolver: zodResolver(updateCardSchema),
    defaultValues: { expiryMonth: "", expiryYear: "", name: "", avsZip: "" },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest("DELETE", `/api/customers/${customerId}/vault-card/${cardId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Card deleted successfully" });
      setDeletingCard(null);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete card", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultCardMutation = useMutation({
    mutationFn: async ({ cardId, token }: { cardId: string; token: string }) => {
      const res = await apiRequest("PUT", `/api/customers/${customerId}/vault-card/${cardId}`, { token, isDefault: true });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Default card updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to set default card", description: error.message, variant: "destructive" });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateCardSchema>) => {
      const res = await apiRequest("PUT", `/api/customers/${customerId}/vault-card/${editingCard!.id}`, { ...data, token: editingCard!.token });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Card updated successfully" });
      setEditingCard(null);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update card", description: error.message, variant: "destructive" });
    },
  });

  function openEditDialog(card: VaultedCard) {
    setEditingCard(card);
    form.reset({
      expiryMonth: card.expMonth ? String(card.expMonth).padStart(2, "0") : "",
      expiryYear: card.expYear ? String(card.expYear) : "",
      name: card.cardholderName || "",
      avsZip: "",
    });
  }

  if (cards.length === 0 && banks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No saved payment methods for this customer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <Card key={card.id} className="hover-elevate" data-testid={`card-vaulted-${card.id}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{card.cardBrand || "Card"} •••• {card.last4}</p>
                    {card.isDefault && <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal text-[11px]">Default</Badge>}
                    {!card.isActive && <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal text-[11px]">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Exp: {card.expMonth}/{card.expYear} • {card.cardholderName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!card.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDefaultCardMutation.mutate({ cardId: card.id, token: card.token })}
                    disabled={setDefaultCardMutation.isPending}
                    data-testid={`button-set-default-card-${card.id}`}
                  >
                    {setDefaultCardMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Star className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Set Default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(card)}
                  data-testid={`button-edit-card-${card.id}`}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeletingCard(card)}
                  data-testid={`button-delete-card-${card.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {banks.map((bank) => (
        <Card key={bank.id} className="hover-elevate" data-testid={`card-bank-${bank.id}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {bank.bankName || "Bank"} •••• {bank.last4}
                    {bank.isDefault && <Badge variant="outline" className="ml-2">Default</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bank.accountType} • {bank.accountHolderName}
                  </p>
                </div>
              </div>
              <Badge variant={bank.isActive ? "default" : "secondary"}>
                {bank.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Card</DialogTitle>
            <DialogDescription>
              Update details for {editingCard?.cardBrand || "Card"} •••• {editingCard?.last4}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateCardMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expiryMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Month</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expiry-month">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const val = String(i + 1).padStart(2, "0");
                            return <SelectItem key={val} value={val}>{val}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiryYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Year</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expiry-year">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const val = String(new Date().getFullYear() + i);
                            return <SelectItem key={val} value={val}>{val}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cardholder Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-cardholder-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="avsZip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing ZIP Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional" data-testid="input-avs-zip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCard(null)} data-testid="button-cancel-update">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCardMutation.isPending} data-testid="button-submit-update">
                  {updateCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Card
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCard} onOpenChange={(open) => !open && setDeletingCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vaulted Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingCard?.cardBrand || "Card"} •••• {deletingCard?.last4} from the vault? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingCard && deleteCardMutation.mutate(deletingCard.id)}
              disabled={deleteCardMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteCardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PurchasesTab({ purchases, storeOrders }: { purchases: PurchaseWithProduct[]; storeOrders: StoreOrderWithItems[] }) {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithProduct | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrderWithItems | null>(null);

  function handlePurchaseClick(purchase: PurchaseWithProduct) {
    if (purchase.orderNumber) {
      const matchingOrder = storeOrders.find(o => o.orderNumber === purchase.orderNumber);
      if (matchingOrder) {
        setSelectedOrder(matchingOrder);
        return;
      }
    }
    setSelectedPurchase(purchase);
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No purchases found for this customer</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {purchases.map((purchase) => {
          const linkedOrder = purchase.orderNumber ? storeOrders.find(o => o.orderNumber === purchase.orderNumber) : undefined;
          const hasOrderLink = !!linkedOrder;
          const orderSubtotal = linkedOrder ? parseFloat(linkedOrder.subtotal || "0") : 0;
          const orderTax = linkedOrder ? parseFloat(linkedOrder.taxAmount || "0") : 0;
          const orderShipping = linkedOrder ? parseFloat(linkedOrder.shippingAmount || "0") : 0;
          const orderTotal = linkedOrder ? parseFloat(linkedOrder.totalAmount || "0") : 0;
          const orderDiscountAmt = Math.round((orderSubtotal + orderTax + orderShipping - orderTotal) * 100) / 100;
          const hasOrderDiscount = hasOrderLink && orderDiscountAmt > 0.005;
          return (
            <Card
              key={purchase.id}
              className="hover-elevate cursor-pointer"
              data-testid={`card-purchase-${purchase.id}`}
              onClick={() => handlePurchaseClick(purchase)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{purchase.itemName || "Unknown Product"}</p>
                      {purchase.itemDescription && (
                        <p className="text-sm text-muted-foreground truncate">{purchase.itemDescription}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {purchase.serialNumber && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {purchase.serialNumber}
                          </span>
                        )}
                        {purchase.invoiceNumber && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Inv #{purchase.invoiceNumber}
                          </span>
                        )}
                        {purchase.orderNumber && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            Order #{purchase.orderNumber}
                          </span>
                        )}
                        {purchase.quantity && purchase.quantity > 1 && (
                          <span className="text-sm text-muted-foreground">Qty: {purchase.quantity}</span>
                        )}
                        <span className="text-sm text-muted-foreground">{formatDate(purchase.soldAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {hasOrderLink ? (
                        <>
                          <span className="font-medium" data-testid={`text-purchase-paid-${purchase.id}`}>{formatCurrency(linkedOrder!.totalAmount)}</span>
                          {hasOrderDiscount && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Subtotal: <span className="line-through">{formatCurrency(linkedOrder!.subtotal)}</span>
                            </p>
                          )}
                        </>
                      ) : purchase.itemPrice ? (
                        <span className="font-medium">{formatCurrency(purchase.itemPrice)}</span>
                      ) : null}
                    </div>
                    <Badge variant="default">
                      {purchase.source === "invoice" ? "Invoiced" : purchase.source === "pos" ? "POS Sale" : purchase.source === "store" ? "Store" : "Sold"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      data-testid={`button-view-purchase-${purchase.id}`}
                      onClick={(e) => { e.stopPropagation(); handlePurchaseClick(purchase); }}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Purchase detail dialog (for non-order purchases) */}
      <Dialog open={!!selectedPurchase} onOpenChange={(open) => { if (!open) setSelectedPurchase(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedPurchase?.itemName || "Purchase Detail"}</DialogTitle>
            <DialogDescription>{formatDate(selectedPurchase?.soldAt)}</DialogDescription>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-3">
              {selectedPurchase.itemDescription && (
                <p className="text-sm text-muted-foreground">{selectedPurchase.itemDescription}</p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {selectedPurchase.itemPrice && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Price</p>
                    <p className="text-sm font-semibold" data-testid="text-purchase-detail-price">{formatCurrency(selectedPurchase.itemPrice)}</p>
                  </div>
                )}
                {selectedPurchase.quantity && selectedPurchase.quantity > 1 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Quantity</p>
                    <p className="text-sm">{selectedPurchase.quantity}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Source</p>
                  <p className="text-sm capitalize">
                    {selectedPurchase.source === "invoice" ? "Invoiced" : selectedPurchase.source === "pos" ? "POS Sale" : selectedPurchase.source === "store" ? "Store" : "Sold"}
                  </p>
                </div>
                {selectedPurchase.serialNumber && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Serial Number</p>
                    <p className="text-sm font-mono" data-testid="text-purchase-serial">{selectedPurchase.serialNumber}</p>
                  </div>
                )}
                {selectedPurchase.invoiceNumber && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Invoice</p>
                    <p className="text-sm font-mono">{selectedPurchase.invoiceNumber}</p>
                  </div>
                )}
                {selectedPurchase.orderNumber && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Order</p>
                    <p className="text-sm font-mono">{selectedPurchase.orderNumber}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order detail when drilling from a purchase */}
      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  );
}

function OrderDetailDialog({ order, onClose }: { order: StoreOrderWithItems | null; onClose: () => void }) {
  if (!order) return null;

  // Compute discount from order math — works even when promoUse join is unavailable
  const computedSubtotal = parseFloat(order.subtotal || "0");
  const computedTax = parseFloat(order.taxAmount || "0");
  const computedShipping = parseFloat(order.shippingAmount || "0");
  const computedTotal = parseFloat(order.totalAmount || "0");
  const computedDiscount = Math.round((computedSubtotal + computedTax + computedShipping - computedTotal) * 100) / 100;
  const hasDiscount = computedDiscount > 0.005; // ignore sub-cent rounding

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order #{order.orderNumber}</DialogTitle>
          <DialogDescription>{formatDate(order.createdAt)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Status + source */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize text-muted-foreground font-normal" data-testid="badge-order-detail-status">
              {order.status || "pending"}
            </Badge>
            {order.source && (
              <Badge variant="outline" className="text-muted-foreground font-normal text-[11px]">
                {order.source === "agent_portal" ? "Agent Portal" : order.source === "payer_portal" ? "Customer Store" : order.source}
              </Badge>
            )}
          </div>

          {/* Items */}
          {order.items.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Items</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        {item.serialNumber && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />{item.serialNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">{formatCurrency(item.amount)}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {/* Show promo with code when available, otherwise show plain Discount from math */}
            {order.promoUse ? (
              <div className="flex justify-between text-sm" data-testid="text-promo-discount-line">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Promo ({order.promoUse.code})
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  -{formatCurrency(order.promoUse.discountAmount)}
                </span>
              </div>
            ) : hasDiscount ? (
              <div className="flex justify-between text-sm" data-testid="text-promo-discount-line">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Discount
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  -{formatCurrency(computedDiscount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(order.taxAmount || 0)}</span>
            </div>
            {order.shippingAmount && parseFloat(order.shippingAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatCurrency(order.shippingAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span data-testid="text-order-detail-total">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>

          {/* Promo code metadata card — only when we have the full promo record */}
          {order.promoUse && (
            <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Promo Code Applied
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  Code: <span className="font-mono font-semibold text-foreground" data-testid="text-promo-code">{order.promoUse.code}</span>
                </span>
                {order.promoUse.promoName && (
                  <span>Name: <span className="font-medium text-foreground">{order.promoUse.promoName}</span></span>
                )}
                <span>
                  Discount: <span className="font-medium text-emerald-600 dark:text-emerald-400" data-testid="text-promo-discount-amount">-{formatCurrency(order.promoUse.discountAmount)}</span>
                  {order.promoUse.discountType === "percent" ? " (% off)" : " (fixed)"}
                </span>
              </div>
            </div>
          )}

          {/* Payment status */}
          {order.paymentStatus && (
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Payment</p>
              <p className="text-sm capitalize">{order.paymentStatus}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StoreOrdersTab({ orders }: { orders: StoreOrderWithItems[] }) {
  const [selectedOrder, setSelectedOrder] = useState<StoreOrderWithItems | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No store orders found for this customer</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {orders.map((order) => (
          <Card
            key={order.id}
            className="hover-elevate cursor-pointer"
            data-testid={`card-store-order-${order.id}`}
            onClick={() => setSelectedOrder(order)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Store className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium" data-testid={`text-order-number-${order.id}`}>
                      Order #{order.orderNumber}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-sm text-muted-foreground">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    {order.items.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {order.items.slice(0, 2).map((item) => (
                          <span key={item.id} className="text-xs text-muted-foreground">
                            {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </span>
                        ))}
                        {order.items.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{order.items.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium" data-testid={`text-order-total-${order.id}`}>
                    {formatCurrency(order.totalAmount)}
                  </span>
                  <Badge variant="outline" className="text-muted-foreground font-normal capitalize" data-testid={`badge-order-status-${order.id}`}>
                    {order.status || "pending"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    data-testid={`button-view-order-${order.id}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </>
  );
}

const addNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

type AddNoteForm = z.infer<typeof addNoteSchema>;

function NotesTab({ notes, customerId }: { notes: CustomerNote[]; customerId: string }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddNoteForm>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { content: "" },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: AddNoteForm) => {
      const res = await apiRequest("POST", `/api/customers/${customerId}/notes`, { content: data.content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
      form.reset();
      setIsAddOpen(false);
      toast({ title: "Note added", description: "Customer note has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) form.reset();
    setIsAddOpen(open);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-note">
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm" data-testid="text-no-notes">No notes for this customer</p>
        </div>
      ) : (
        notes.map((note) => (
          <Card key={note.id} data-testid={`card-note-${note.id}`}>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground mb-2">{formatDate(note.createdAt)}</p>
              <p>{note.content}</p>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={isAddOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add a note to this customer's record.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createNoteMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your note..."
                        rows={4}
                        data-testid="input-note-content"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-note">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createNoteMutation.isPending}
                  data-testid="button-save-note"
                >
                  {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Note
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentsTab({ attachments, customerId }: { attachments: InvoiceAttachment[]; customerId: string }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAttachment = async (file: globalThis.File) => {
    setIsUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type
      });
      const { uploadURL, objectPath } = await urlRes.json();
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });
      if (!putRes.ok) {
        throw new Error("Failed to upload file to storage");
      }
      await apiRequest("POST", `/api/customers/${customerId}/attachments`, {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        objectPath
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "details"] });
      toast({ title: "File uploaded", description: `${file.name} has been attached.` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{attachments.length} attachment{attachments.length !== 1 ? "s" : ""}</p>
        <label>
          <input
            type="file"
            className="hidden"
            id="customer-attachment-upload"
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                Array.from(files).forEach(f => uploadAttachment(f));
              }
              e.target.value = "";
            }}
            data-testid="input-customer-attachment-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById("customer-attachment-upload")?.click()}
            data-testid="button-upload-customer-attachment"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? "Uploading..." : "Add Attachment"}
          </Button>
        </label>
      </div>
      {attachments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No attachments yet. Upload a file to get started.</p>
        </div>
      )}
      {attachments.map((att) => {
        const isImage = att.contentType?.startsWith("image/");
        const sizeKB = att.fileSize ? (parseInt(att.fileSize.toString()) / 1024).toFixed(1) : null;
        return (
          <Card key={att.id} data-testid={`card-attachment-${att.id}`}>
            <CardContent className="flex items-center gap-3 py-3">
              {isImage ? (
                <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.fileName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {sizeKB && <span>{sizeKB} KB</span>}
                  {att.invoiceId && <span>Invoice: {att.invoiceId.substring(0, 8)}...</span>}
                  {att.contractId && <span>Recurring: {att.contractId.substring(0, 8)}...</span>}
                  {att.createdAt && <span>{formatDate(att.createdAt)}</span>}
                </div>
              </div>
              <a
                href={`/api/attachments/${att.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" data-testid={`button-download-attachment-${att.id}`}>
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [detailDeleteOpen, setDetailDeleteOpen] = useState(false);
  const [detailDeletionCheck, setDetailDeletionCheck] = useState<{ canHardDelete: boolean; linkedCounts: Record<string, number> } | null>(null);
  const [detailDeletionCheckLoading, setDetailDeletionCheckLoading] = useState(false);

  const { data, isLoading, error } = useQuery<CustomerDetails>({
    queryKey: ["/api/customers", params.id, "details"],
    enabled: !!params.id
  });

  const { data: salesAgents = [] } = useQuery<SalesAgent[]>({
    queryKey: ["/api/sales-agents"]
  });

  const { data: kpiData } = useQuery<{ rank: number; total: number }>({
    queryKey: ["/api/customers", params.id, "kpi"],
    enabled: !!params.id
  });

  const editForm = useForm<EditCustomerForm>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      salesOfficeAgent: "",
      accountNumber: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      legalCompanyName: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: EditCustomerForm) => {
      return apiRequest("PUT", `/api/customers/${params.id}`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", params.id, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer updated",
        description: "Customer details have been saved successfully."
      });
      setIsEditOpen(false);
    },
    onError: () => {
      toast({
        title: "Error updating customer",
        description: "Failed to save customer details.",
        variant: "destructive"
      });
    }
  });

  const openEditDialog = () => {
    if (data?.customer) {
      const c = data.customer;
      const addr = data.addresses?.find(a => a.isDefault) || data.addresses?.[0];
      editForm.reset({
        salesOfficeAgent: c.salesOfficeAgent || "",
        accountNumber: c.accountNumber || "",
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        email: c.email || "",
        phone: c.phone || "",
        company: c.company || "",
        legalCompanyName: c.legalCompanyName || "",
        address1: addr?.address1 || "",
        address2: addr?.address2 || "",
        city: addr?.city || "",
        state: addr?.state || "",
        postalCode: addr?.postalCode || "",
        country: addr?.country || "US",
      });
      setIsEditOpen(true);
    }
  };

  const onEditSubmit = (formData: EditCustomerForm) => {
    updateMutation.mutate(formData);
  };

  const detailDeleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("DELETE", `/api/customers/${customerId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted", description: "The customer record has been permanently removed." });
      navigate("/customers");
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Unable to delete this customer.", variant: "destructive" });
    }
  });

  const detailArchiveMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("PATCH", `/api/customers/${customerId}/archive`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", params.id, "details"] });
      toast({ title: "Customer archived", description: "The customer has been archived and removed from active lists." });
      setDetailDeleteOpen(false);
      setDetailDeletionCheck(null);
    },
    onError: () => {
      toast({ title: "Archive failed", description: "Unable to archive this customer.", variant: "destructive" });
    }
  });

  const openDetailDeleteDialog = async () => {
    if (!data?.customer) return;
    setDetailDeleteOpen(true);
    setDetailDeletionCheck(null);
    setDetailDeletionCheckLoading(true);
    try {
      const res = await apiRequest("GET", `/api/customers/${data.customer.id}/deletion-check`);
      const check = await res.json();
      setDetailDeletionCheck(check);
    } catch {
      toast({ title: "Error", description: "Could not check deletion eligibility.", variant: "destructive" });
      setDetailDeleteOpen(false);
    } finally {
      setDetailDeletionCheckLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load customer details</p>
          <Link href="/customers">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { customer, addresses, invoices, payments, contracts, vaultedCards, vaultedBanks, notes, purchases, attachments = [], storeOrders = [] } = data;
  const primaryAddress = addresses.find(a => a.isDefault) || addresses[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/customers">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <PageHeader
            title={`${customer.firstName} ${customer.lastName}`}
            description={customer.company ? customer.company : "Customer details and history"}
            className="mb-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openEditDialog} data-testid="button-edit-customer">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Customer
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-customer-more-actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!customer.isArchived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={openDetailDeleteDialog}
                    data-testid="menu-detail-delete-customer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Customer
                  </DropdownMenuItem>
                </>
              )}
              {customer.isArchived && (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <Archive className="h-4 w-4 mr-2" />
                  Customer is Archived
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CustomerHeader customer={customer} address={primaryAddress} />

      {(() => {
        const lifetimeRevenue = payments
          .filter(p => ['approved', 'settled'].includes(p.status))
          .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

        const openBalance = invoices
          .filter(i => ['sent', 'viewed', 'partial', 'overdue'].includes(i.status))
          .reduce((sum, i) => sum + (parseFloat(i.totalAmount || '0') - parseFloat((i as any).paidAmount || '0')), 0);

        const freqToMonthly: Record<string, number> = {
          weekly: 52 / 12,
          biweekly: 26 / 12,
          semimonthly: 2,
          monthly: 1,
          quarterly: 1 / 3,
          annually: 1 / 12,
        };
        const activeRecurringMonthly = contracts
          .filter(c => c.status === 'active')
          .reduce((sum, c) => sum + parseFloat(c.amount || '0') * (freqToMonthly[c.frequency] ?? 1), 0);

        const allDates = [
          ...payments.map(p => p.createdAt ? new Date(p.createdAt).getTime() : 0),
          ...invoices.map(i => i.updatedAt ? new Date(i.updatedAt).getTime() : 0),
          ...contracts.map(c => c.updatedAt ? new Date(c.updatedAt).getTime() : 0),
          ...storeOrders.map(o => (o as any).createdAt ? new Date((o as any).createdAt).getTime() : 0),
        ].filter(t => t > 0);
        const lastActivityTs = allDates.length > 0 ? Math.max(...allDates) : null;
        const lastActivityDate = lastActivityTs ? new Date(lastActivityTs) : null;

        const fmt = (n: number) => n >= 1000
          ? `$${(n / 1000).toFixed(1)}k`
          : `$${n.toFixed(2)}`;

        const fmtDate = (d: Date | null) => {
          if (!d) return '—';
          const now = new Date();
          const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
          if (diff === 0) return 'Today';
          if (diff === 1) return 'Yesterday';
          if (diff < 7) return `${diff}d ago`;
          if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
          if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
          return `${Math.floor(diff / 365)}y ago`;
        };

        const kpis = [
          {
            icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
            value: fmt(lifetimeRevenue),
            label: 'Lifetime Revenue',
            valueClass: 'text-emerald-700 dark:text-emerald-400',
            testId: 'kpi-lifetime-revenue',
          },
          {
            icon: <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
            value: openBalance > 0 ? fmt(openBalance) : '$0.00',
            label: 'Open Balance',
            valueClass: openBalance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
            testId: 'kpi-open-balance',
          },
          {
            icon: <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
            value: activeRecurringMonthly > 0 ? `${fmt(activeRecurringMonthly)}/mo` : '—',
            label: 'Active Recurring',
            valueClass: activeRecurringMonthly > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground',
            testId: 'kpi-active-recurring',
          },
          {
            icon: <Activity className="h-3.5 w-3.5 text-muted-foreground" />,
            value: fmtDate(lastActivityDate),
            label: 'Last Activity',
            valueClass: 'text-foreground',
            testId: 'kpi-last-activity',
          },
          {
            icon: <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />,
            value: String(storeOrders.length),
            label: 'Orders',
            valueClass: 'text-foreground',
            testId: 'kpi-orders',
          },
          {
            icon: <Trophy className="h-3.5 w-3.5 text-amber-500" />,
            value: kpiData ? `#${kpiData.rank} of ${kpiData.total}` : '—',
            label: 'Revenue Rank',
            valueClass: 'text-foreground',
            testId: 'kpi-revenue-rank',
          },
        ];

        return (
          <div className="flex flex-wrap gap-0 rounded-lg border bg-muted/20 overflow-hidden" data-testid="customer-kpi-strip">
            {kpis.map((kpi, i) => (
              <div
                key={kpi.label}
                className={`flex flex-col gap-1 px-5 py-3.5 flex-1 min-w-[130px] ${i < kpis.length - 1 ? 'border-r border-border/60' : ''}`}
                data-testid={kpi.testId}
              >
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${kpi.valueClass}`}>
                  {kpi.icon}
                  <span>{kpi.value}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-none">
                  {kpi.label}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 mb-6" data-testid="tabs-customer">
          <TabsTrigger value="invoices" className="text-xs" data-testid="tab-invoices">
            Invoices {invoices.length > 0 && <span className="ml-1 opacity-60">({invoices.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs" data-testid="tab-payments">
            Payments {payments.length > 0 && <span className="ml-1 opacity-60">({payments.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="recurring" className="text-xs" data-testid="tab-recurring">
            Recurring {contracts.length > 0 && <span className="ml-1 opacity-60">({contracts.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="attachments" className="text-xs" data-testid="tab-attachments">
            Files {attachments.length > 0 && <span className="ml-1 opacity-60">({attachments.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="methods" className="text-xs" data-testid="tab-methods">
            Vault {(vaultedCards.length + vaultedBanks.length) > 0 && <span className="ml-1 opacity-60">({vaultedCards.length + vaultedBanks.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="text-xs" data-testid="tab-purchases">
            Purchases {purchases.length > 0 && <span className="ml-1 opacity-60">({purchases.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="store-orders" className="text-xs" data-testid="tab-store-orders">
            Orders {storeOrders.length > 0 && <span className="ml-1 opacity-60">({storeOrders.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs" data-testid="tab-notes">
            Notes {notes.length > 0 && <span className="ml-1 opacity-60">({notes.length})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <InvoicesTab invoices={invoices} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab payments={payments} />
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTab contracts={contracts} />
        </TabsContent>

        <TabsContent value="methods">
          <PaymentMethodsTab cards={vaultedCards} banks={vaultedBanks} customerId={params.id!} />
        </TabsContent>

        <TabsContent value="purchases">
          <PurchasesTab purchases={purchases} storeOrders={storeOrders} />
        </TabsContent>

        <TabsContent value="store-orders">
          <StoreOrdersTab orders={storeOrders} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab notes={notes} customerId={customer.id} />
        </TabsContent>

        <TabsContent value="attachments">
          <AttachmentsTab attachments={attachments} customerId={customer.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="flex flex-col max-h-[88vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
          <Form {...editForm}>
            <form id="edit-customer-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3 pb-1">
              <SectionLabel>Customer Basics</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="salesOfficeAgent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Agent</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="edit-select-sales-agent">
                            <SelectValue placeholder="Select a sales agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {salesAgents.filter(a => a.isActive).map((agent) => (
                            <SelectItem key={agent.id} value={agent.name}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Customer account number"
                          data-testid="edit-input-account-number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          data-testid="edit-input-first-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          data-testid="edit-input-last-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@company.com"
                          data-testid="edit-input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(555) 123-4567"
                          data-testid="edit-input-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <SectionLabel>Business Details</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name (DBA)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doing Business As name"
                          data-testid="edit-input-company"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="legalCompanyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Company Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Legal entity name"
                          data-testid="edit-input-legal-company-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <SectionLabel>Address</SectionLabel>
              <div className="space-y-3">
                  <FormField
                    control={editForm.control}
                    name="address1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Main Street"
                            data-testid="edit-input-address1"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Suite 100"
                            data-testid="edit-input-address2"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={editForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="New York"
                              data-testid="edit-input-city"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="NY"
                              data-testid="edit-input-state"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={editForm.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="10001"
                              data-testid="edit-input-postal-code"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="US"
                              data-testid="edit-input-country"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
            </form>
          </Form>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              form="edit-customer-form"
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-customer"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive dialog */}
      <Dialog open={detailDeleteOpen} onOpenChange={(open) => { if (!open) { setDetailDeleteOpen(false); setDetailDeletionCheck(null); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-detail-delete-customer">
          <DialogHeader>
            {detailDeletionCheckLoading ? (
              <>
                <DialogTitle>Checking record…</DialogTitle>
                <DialogDescription>Verifying whether this customer can be permanently deleted.</DialogDescription>
              </>
            ) : detailDeletionCheck?.canHardDelete ? (
              <>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Permanently Delete Customer
                </DialogTitle>
                <DialogDescription>
                  <strong>{customer.firstName} {customer.lastName}</strong> has no linked records.
                  This action is permanent and cannot be undone.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Archive Customer
                </DialogTitle>
                <DialogDescription>
                  <strong>{customer.firstName} {customer.lastName}</strong> has linked records and cannot be permanently deleted.
                  Archiving removes them from active lists while keeping all history intact.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {detailDeletionCheckLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!detailDeletionCheckLoading && detailDeletionCheck && !detailDeletionCheck.canHardDelete && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Linked records blocking deletion</p>
              {Object.entries(detailDeletionCheck.linkedCounts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <Badge variant="outline" className="font-mono text-xs">{count}</Badge>
                  </div>
                ))
              }
            </div>
          )}

          {!detailDeletionCheckLoading && detailDeletionCheck && !detailDeletionCheck.canHardDelete && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Archived customers are hidden from all active lists. Their payments, invoices, and other records remain fully intact and accessible.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDetailDeleteOpen(false); setDetailDeletionCheck(null); }}>
              Cancel
            </Button>
            {!detailDeletionCheckLoading && detailDeletionCheck?.canHardDelete && (
              <Button
                variant="destructive"
                onClick={() => data?.customer && detailDeleteMutation.mutate(data.customer.id)}
                disabled={detailDeleteMutation.isPending}
                data-testid="button-detail-confirm-delete"
              >
                {detailDeleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" />Delete Permanently</>}
              </Button>
            )}
            {!detailDeletionCheckLoading && detailDeletionCheck && !detailDeletionCheck.canHardDelete && (
              <Button
                onClick={() => data?.customer && detailArchiveMutation.mutate(data.customer.id)}
                disabled={detailArchiveMutation.isPending}
                data-testid="button-detail-confirm-archive"
              >
                {detailArchiveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Archiving…</> : <><Archive className="h-4 w-4 mr-2" />Archive Customer</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
