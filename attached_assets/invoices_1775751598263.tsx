import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
  Plus,
  Search,
  Download,
  MoreHorizontal,
  Send,
  Eye,
  Loader2,
  Edit,
  Trash2,
  Mail,
  Receipt
} from "lucide-react";
import { useLocation } from "wouter";
import type { Invoice, Customer, Contract, SalesAgent } from "@shared/schema";

const formatCurrency = (amount: number | string | null | undefined) => {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

function InvoiceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "overdue":
      return <Badge variant="destructive" className="font-normal capitalize">Overdue</Badge>;
    case "sent":
      return (
        <Badge variant="outline" className="border-blue-300 text-blue-700 font-normal capitalize">
          Sent
        </Badge>
      );
    case "viewed":
      return (
        <Badge variant="outline" className="border-violet-300 text-violet-700 font-normal capitalize">
          Viewed
        </Badge>
      );
    case "paid":
      return (
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 font-normal capitalize">
          Paid
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal capitalize">
          Cancelled
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal capitalize">
          Draft
        </Badge>
      );
  }
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"]
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"]
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"]
  });

  const { data: salesAgents } = useQuery<SalesAgent[]>({
    queryKey: ["/api/sales-agents"]
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted", description: "The invoice has been deleted." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Only unpaid invoices can be deleted.",
        variant: "destructive"
      });
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (invoiceId: string) => apiRequest("POST", `/api/invoices/${invoiceId}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice sent", description: "The invoice has been sent to the customer." });
    },
    onError: () => toast({ title: "Error", description: "Failed to send invoice.", variant: "destructive" })
  });

  const resendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => apiRequest("POST", `/api/invoices/${invoiceId}/resend`),
    onSuccess: () => toast({ title: "Invoice resent", description: "The invoice email has been resent." }),
    onError: () => toast({ title: "Error", description: "Failed to resend invoice.", variant: "destructive" })
  });

  const resendReceiptMutation = useMutation({
    mutationFn: async (invoiceId: string) => apiRequest("POST", `/api/invoices/${invoiceId}/resend-receipt`),
    onSuccess: () => toast({ title: "Receipt resent", description: "The payment receipt has been resent." }),
    onError: () => toast({ title: "Error", description: "Failed to resend receipt.", variant: "destructive" })
  });

  const outstandingBalance = useMemo(() =>
    (invoices ?? [])
      .filter(i => !["paid", "cancelled", "draft"].includes(i.status ?? ""))
      .reduce((sum, i) => sum + Math.max(0, parseFloat(i.totalAmount || "0") - parseFloat(i.paidAmount || "0")), 0),
    [invoices]);

  const openCount = useMemo(() =>
    (invoices ?? []).filter(i => ["sent", "overdue", "viewed"].includes(i.status ?? "")).length,
    [invoices]);

  const overdueCount = useMemo(() =>
    (invoices ?? []).filter(i => i.status === "overdue").length,
    [invoices]);

  const draftCount = useMemo(() =>
    (invoices ?? []).filter(i => i.status === "draft").length,
    [invoices]);

  const filteredInvoices = useMemo(() => {
    return (invoices ?? []).filter(inv => {
      const cust = customers?.find(c => c.id === inv.customerId);
      const q = search.toLowerCase();

      let liabCustName = "";
      let liabAgentName = "";
      if (inv.liabilityContractId) {
        const linkedContract = contracts?.find(c => c.id === inv.liabilityContractId);
        if (linkedContract?.customerId) {
          const liabCust = customers?.find(c => c.id === linkedContract.customerId);
          liabCustName = [liabCust?.firstName, liabCust?.lastName].filter(Boolean).join(" ");
        }
        if (inv.liabilityAgentId) {
          const agent = salesAgents?.find(a => a.id === inv.liabilityAgentId);
          liabAgentName = agent?.name ?? "";
        }
      }

      const matchesSearch = !search ||
        (inv.invoiceNumber ?? "").toLowerCase().includes(q) ||
        ([cust?.firstName, cust?.lastName].filter(Boolean).join(" ")).toLowerCase().includes(q) ||
        (cust?.companyName ?? "").toLowerCase().includes(q) ||
        (cust?.accountNumber ?? "").toLowerCase().includes(q) ||
        liabCustName.toLowerCase().includes(q) ||
        liabAgentName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, customers, contracts, salesAgents, search, statusFilter]);

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage customer invoices and track collections</p>
      </div>

      {/* Compact metrics strip */}
      {invoices && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
          {outstandingBalance > 0 && (
            <span>
              <span className="font-semibold text-foreground tabular-nums">{formatCurrency(outstandingBalance)}</span>
              {" "}outstanding
            </span>
          )}
          {openCount > 0 && (
            <span>
              <span className="font-semibold text-foreground tabular-nums">{openCount}</span>
              {" "}open
            </span>
          )}
          {overdueCount > 0 && (
            <span className="font-semibold text-red-600 dark:text-red-400">
              {overdueCount} overdue
            </span>
          )}
          {draftCount > 0 && (
            <span>
              <span className="font-semibold text-foreground tabular-nums">{draftCount}</span>
              {" "}draft
            </span>
          )}
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-invoice-count">
          {isLoading ? "Loading..." : `${filteredInvoices.length} ${filteredInvoices.length === 1 ? "invoice" : "invoices"}`}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by invoice #, customer, account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-60 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40 text-sm" data-testid="select-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8"
            onClick={() => setLocation("/invoice")}
            data-testid="button-create-invoice"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <Receipt className="h-9 w-9 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {(invoices || []).length === 0 ? "No invoices yet" : "No invoices match your filters"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(invoices || []).length === 0
                    ? "Create your first invoice to get started."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            </div>
          ) : (
            <Table data-testid="table-invoices">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Invoice</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Customer</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase text-right">Total</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase text-right">Balance Due</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Due Date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const isLiability = !!invoice.liabilityContractId;
                  const cust = customers?.find(c => c.id === invoice.customerId);

                  let liabCustName = "";
                  let liabAgentName = "";
                  if (isLiability) {
                    const linkedContract = contracts?.find(c => c.id === invoice.liabilityContractId);
                    if (linkedContract?.customerId) {
                      const liabCust = customers?.find(c => c.id === linkedContract.customerId);
                      liabCustName = [liabCust?.firstName, liabCust?.lastName].filter(Boolean).join(" ") || liabCust?.companyName || "";
                    }
                    if (invoice.liabilityAgentId) {
                      const agent = salesAgents?.find(a => a.id === invoice.liabilityAgentId);
                      liabAgentName = agent?.name ?? "";
                    }
                  }

                  const custName = isLiability
                    ? (liabCustName || "—")
                    : ([cust?.firstName, cust?.lastName].filter(Boolean).join(" ") || cust?.companyName || "—");
                  const dba = (!isLiability && cust?.companyName && cust.companyName !== custName) ? cust.companyName : null;
                  const acct = (!isLiability && cust?.accountNumber) ? cust.accountNumber : null;
                  const total = parseFloat(invoice.totalAmount || "0");
                  const paid = parseFloat(invoice.paidAmount || "0");
                  const balance = Math.max(0, total - paid);
                  const isOverdue = invoice.status === "overdue";
                  const isPaid = invoice.status === "paid";

                  return (
                    <TableRow
                      key={invoice.id}
                      className={`cursor-pointer hover-elevate${isOverdue ? " bg-red-50/30 dark:bg-red-950/10" : ""}`}
                      onClick={() => setLocation(`/invoice/${invoice.id}`)}
                      data-testid={`row-invoice-${invoice.id}`}
                    >
                      {/* Invoice # + created date */}
                      <TableCell className="pl-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-sm font-medium leading-snug" data-testid={`text-invoice-number-${invoice.id}`}>
                            {invoice.invoiceNumber}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 leading-tight">
                            {formatDate(invoice.createdAt)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Customer + DBA or account sub-line */}
                      <TableCell>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm leading-snug" data-testid={`text-customer-${invoice.id}`}>{custName}</span>
                          {isLiability && liabAgentName ? (
                            <span className="text-[11px] text-muted-foreground/70 leading-tight truncate" data-testid={`text-liability-agent-${invoice.id}`}>
                              Agent liability billed to {liabAgentName}
                            </span>
                          ) : (acct || dba) ? (
                            <span className="text-[11px] text-muted-foreground/70 leading-tight font-mono truncate" data-testid={`text-account-${invoice.id}`}>
                              {acct || dba}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status ?? "draft"} />
                      </TableCell>

                      {/* Total */}
                      <TableCell className="text-right">
                        <span className={`text-sm tabular-nums${isPaid ? " text-muted-foreground" : " font-semibold"}`}>
                          {formatCurrency(total)}
                        </span>
                        {paid > 0 && !isPaid && (
                          <div className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(paid)} paid</div>
                        )}
                      </TableCell>

                      {/* Balance Due */}
                      <TableCell className="text-right">
                        {isPaid ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : balance > 0 ? (
                          <span className={`text-sm font-semibold tabular-nums${isOverdue ? " text-red-600 dark:text-red-400" : ""}`}>
                            {formatCurrency(balance)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Due date */}
                      <TableCell>
                        {invoice.dueDate ? (
                          <span className={`text-xs tabular-nums${isOverdue ? " text-red-600 dark:text-red-400 font-semibold" : " text-muted-foreground"}`}>
                            {formatDate(invoice.dueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              data-testid={`button-actions-${invoice.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setLocation(`/invoice/${invoice.id}`); }}
                              data-testid={`menu-view-${invoice.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Invoice
                            </DropdownMenuItem>
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setLocation(`/invoice/${invoice.id}`); }}
                                data-testid={`menu-edit-${invoice.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Invoice
                              </DropdownMenuItem>
                            )}
                            {invoice.status === "draft" && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); sendMutation.mutate(invoice.id); }}
                                disabled={sendMutation.isPending}
                                data-testid={`menu-send-${invoice.id}`}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Invoice
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "overdue") && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); resendInvoiceMutation.mutate(invoice.id); }}
                                disabled={resendInvoiceMutation.isPending}
                                data-testid={`menu-resend-invoice-${invoice.id}`}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Resend Invoice
                              </DropdownMenuItem>
                            )}
                            {invoice.status === "paid" && (
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); resendReceiptMutation.mutate(invoice.id); }}
                                disabled={resendReceiptMutation.isPending}
                                data-testid={`menu-resend-receipt-${invoice.id}`}
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Resend Receipt
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); window.open(`/api/invoices/${invoice.id}/pdf`, "_blank"); }}
                              data-testid={`menu-download-pdf-${invoice.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            {invoice.status !== "paid" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(invoice.id); }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`menu-delete-${invoice.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Invoice
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
