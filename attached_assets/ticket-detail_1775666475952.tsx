import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import MerchantLayout from "@/components/merchant-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, User, Smartphone, MessageSquare, Wrench, Clock, CheckCircle, Loader2, Plus, Pencil, Save, X, DollarSign, Banknote, CreditCard, Package, Wifi, WifiOff, AlertTriangle, Search, Trash2, FileText, PlayCircle, Ban, Printer, Mail, Eye } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import NotificationStatusCard from "@/components/notification-status-card";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  ready_for_pickup: "bg-emerald-100 text-emerald-800",
  picked_up: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [noteContent, setNoteContent] = useState("");
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [partSearch, setPartSearch] = useState("");
  const [partCategoryFilter, setPartCategoryFilter] = useState("all");
  const [customPartMode, setCustomPartMode] = useState(false);
  const [customPartDesc, setCustomPartDesc] = useState("");
  const [customPartPrice, setCustomPartPrice] = useState("");
  const [customPartCost, setCustomPartCost] = useState("");
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<any>({});

  const [addLaborOpen, setAddLaborOpen] = useState(false);
  const [laborDescription, setLaborDescription] = useState("");
  const [laborAmount, setLaborAmount] = useState("");
  const [editingLaborId, setEditingLaborId] = useState<number | null>(null);
  const [editLaborDesc, setEditLaborDesc] = useState("");
  const [editLaborAmount, setEditLaborAmount] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"deposit" | "final_payment">("deposit");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [cashTendered, setCashTendered] = useState("");
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<{ message: string; type: string } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null);
  const [manualEmailOpen, setManualEmailOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualEmailSaleId, setManualEmailSaleId] = useState<number | null>(null);

  const [pickupOpen, setPickupOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  const [addInternalCostOpen, setAddInternalCostOpen] = useState(false);
  const [internalCostDescription, setInternalCostDescription] = useState("");
  const [internalCostAmount, setInternalCostAmount] = useState("");
  const [resendOpen, setResendOpen] = useState(false);
  const [resendReason, setResendReason] = useState("");
  const [resendEmailType, setResendEmailType] = useState("");
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editCostDesc, setEditCostDesc] = useState("");
  const [editCostAmount, setEditCostAmount] = useState("");

  const { data: ticket, isLoading } = useQuery<any>({
    queryKey: ["/api/merchant/tickets", params.id],
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/products"],
    enabled: addPartOpen,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/categories"],
    enabled: addPartOpen,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/employees"],
    enabled: editing,
  });

  const { data: settingsData } = useQuery<any>({ queryKey: ["/api/merchant/settings"] });
  const settings = settingsData?.settings;

  const { data: terminalStatus } = useQuery<any>({
    queryKey: ["/api/merchant/pos/terminal-status"],
    queryFn: async () => {
      const res = await fetch("/api/merchant/pos/terminal-status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: paymentOpen,
  });

  useEffect(() => {
    if (terminalStatus?.terminalId && !selectedTerminalId) {
      setSelectedTerminalId(terminalStatus.terminalId);
    }
  }, [terminalStatus]);

  const productMap = new Map<number, any>();
  products.forEach((p: any) => productMap.set(p.id, p));

  const categoryMap = new Map<number, string>();
  categories.forEach((c: any) => categoryMap.set(c.id, c.name));

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      if (!p.isActive || p.isSerialized) return false;
      if (partCategoryFilter !== "all" && String(p.categoryId) !== partCategoryFilter) return false;
      if (partSearch.trim()) {
        const q = partSearch.toLowerCase();
        const match = (p.name || "").toLowerCase().includes(q)
          || (p.sku || "").toLowerCase().includes(q)
          || (p.barcode || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [products, partCategoryFilter, partSearch]);

  const technicians = employees.filter((e: any) => e.merchantRole === "technician" || e.merchantRole === "owner" || e.merchantRole === "manager");

  const invalidateTicket = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/merchant/tickets", params.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/merchant/tickets"] });
  };

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/merchant/tickets/${params.id}`, { status: newStatus });
    },
    onSuccess: () => {
      invalidateTicket();
      toast({ title: "Status updated" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/merchant/tickets/${params.id}/notes`, {
        content: noteContent,
      });
    },
    onSuccess: () => {
      invalidateTicket();
      setNoteContent("");
      toast({ title: "Note added" });
    },
  });

  const addPartMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(partQuantity) || 1;
      if (customPartMode) {
        if (!customPartDesc.trim()) throw new Error("Description is required");
        if (!customPartPrice || isNaN(parseFloat(customPartPrice)) || parseFloat(customPartPrice) < 0) throw new Error("Valid price is required");
        if (!customPartCost || isNaN(parseFloat(customPartCost)) || parseFloat(customPartCost) < 0) throw new Error("Valid cost is required");
        await apiRequest("POST", `/api/merchant/tickets/${params.id}/parts`, {
          customDescription: customPartDesc.trim(),
          quantity: qty,
          unitPrice: customPartPrice,
          unitCostSnapshot: customPartCost,
        });
      } else {
        const product = productMap.get(parseInt(selectedProductId));
        if (!product) throw new Error("Select a product");
        await apiRequest("POST", `/api/merchant/tickets/${params.id}/parts`, {
          productId: product.id,
          quantity: qty,
          unitPrice: product.cashPrice,
        });
      }
    },
    onSuccess: () => {
      invalidateTicket();
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      setSelectedProductId("");
      setPartQuantity("1");
      setPartSearch("");
      setCustomPartDesc("");
      setCustomPartPrice("");
      setCustomPartCost("");
      setAddPartOpen(false);
      setCustomPartMode(false);
      toast({ title: "Part added to ticket" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deletePartMutation = useMutation({
    mutationFn: async (partId: number) => {
      await apiRequest("DELETE", `/api/merchant/tickets/${params.id}/parts/${partId}`);
    },
    onSuccess: () => {
      invalidateTicket();
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      toast({ title: "Part removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addLaborMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/merchant/tickets/${params.id}/labor`, {
        description: laborDescription,
        amount: laborAmount,
      });
    },
    onSuccess: () => {
      invalidateTicket();
      setLaborDescription("");
      setLaborAmount("");
      setAddLaborOpen(false);
      toast({ title: "Labor charge added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateLaborMutation = useMutation({
    mutationFn: async ({ id, description, amount }: { id: number; description: string; amount: string }) => {
      await apiRequest("PATCH", `/api/merchant/tickets/${params.id}/labor/${id}`, { description, amount });
    },
    onSuccess: () => {
      invalidateTicket();
      setEditingLaborId(null);
      toast({ title: "Labor charge updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteLaborMutation = useMutation({
    mutationFn: async (laborId: number) => {
      await apiRequest("DELETE", `/api/merchant/tickets/${params.id}/labor/${laborId}`);
    },
    onSuccess: () => {
      invalidateTicket();
      toast({ title: "Labor charge removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addInternalCostMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/merchant/tickets/${params.id}/internal-costs`, {
        description: internalCostDescription,
        amount: internalCostAmount,
      });
    },
    onSuccess: () => {
      invalidateTicket();
      setInternalCostDescription("");
      setInternalCostAmount("");
      setAddInternalCostOpen(false);
      toast({ title: "Internal cost added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateInternalCostMutation = useMutation({
    mutationFn: async ({ id, description, amount }: { id: number; description: string; amount: string }) => {
      await apiRequest("PATCH", `/api/merchant/tickets/${params.id}/internal-costs/${id}`, { description, amount });
    },
    onSuccess: () => {
      invalidateTicket();
      setEditingCostId(null);
      toast({ title: "Cost updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteInternalCostMutation = useMutation({
    mutationFn: async (costId: number) => {
      await apiRequest("DELETE", `/api/merchant/tickets/${params.id}/internal-costs/${costId}`);
    },
    onSuccess: () => {
      invalidateTicket();
      toast({ title: "Cost removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/merchant/tickets/${params.id}`, data);
    },
    onSuccess: () => {
      invalidateTicket();
      setEditing(false);
      toast({ title: "Ticket updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/merchant/tickets/${params.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMethod,
          paymentType,
          ...(paymentMethod === "card" && selectedTerminalId ? { terminalId: selectedTerminalId } : {}),
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        const err: any = new Error(body.message || "Payment failed");
        err.errorType = body.errorType;
        err.detail = body.detail;
        throw err;
      }
      return body;
    },
    onSuccess: (data: any) => {
      invalidateTicket();
      setPaymentSuccess({
        saleId: data.sale?.id,
        saleNumber: data.saleNumber,
        baseAmount: data.baseAmount,
        cardUpliftAmount: data.cardUpliftAmount,
        totalCharged: data.totalCharged,
        paymentMethod,
        paymentType,
        cardDetails: data.cardDetails,
        customerEmail: ticket?.customer?.email || null,
        authCode: data.payment?.authorizationCode || null,
        transactionRef: data.payment?.externalTransactionId || null,
      });
    },
    onError: (err: any) => {
      if (err.errorType) {
        setPaymentError({ message: err.message, type: err.errorType });
      } else {
        toast({ title: "Payment failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const pickupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/merchant/tickets/${params.id}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        const err: any = new Error(body.message || "Pickup failed");
        err.errorType = body.errorType;
        err.remainingBalance = body.remainingBalance;
        throw err;
      }
      return body;
    },
    onSuccess: () => {
      invalidateTicket();
      setPickupOpen(false);
      toast({ title: "Device marked as Picked Up" });
    },
    onError: (err: any) => {
      setPickupOpen(false);
      if (err.errorType === "balance_due") {
        toast({
          title: "Payment required",
          description: `$${err.remainingBalance} balance remaining. Collect payment before marking picked up.`,
          variant: "destructive",
        });
        openPaymentDialog("final_payment");
      } else {
        toast({ title: "Pickup failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const applyDiscountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/merchant/tickets/${params.id}/discount`, {
        discountType,
        discountValue,
        reason: discountReason,
      });
    },
    onSuccess: () => {
      invalidateTicket();
      setDiscountOpen(false);
      setDiscountValue("");
      setDiscountReason("");
      toast({ title: "Discount applied" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/merchant/tickets/${params.id}/discount`);
    },
    onSuccess: () => {
      invalidateTicket();
      toast({ title: "Discount removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canEdit = user?.merchantRole === "owner" || user?.merchantRole === "manager" || user?.merchantRole === "technician" || user?.merchantRole === "cashier";
  const canAddParts = canEdit;
  const canDiscount = user?.merchantRole === "owner" || user?.merchantRole === "manager";
  const isTerminal = ticket?.status === "picked_up" || ticket?.status === "cancelled";

  const partsSubtotal = useMemo(() =>
    (ticket?.partsUsed || []).reduce((sum: number, p: any) => sum + (parseFloat(p.unitPrice) * p.quantity), 0), [ticket?.partsUsed]);
  const laborSubtotal = useMemo(() =>
    (ticket?.laborLines || []).reduce((sum: number, l: any) => sum + parseFloat(l.amount), 0), [ticket?.laborLines]);
  const rawSubtotal = Math.round((partsSubtotal + laborSubtotal) * 100) / 100;
  const ticketDiscountAmount = parseFloat(ticket?.discountAmount || "0");
  const discountedSubtotal = Math.max(0, Math.round((rawSubtotal - ticketDiscountAmount) * 100) / 100);
  const taxRate = ticket?.taxRate || 0;
  const taxLabor = ticket?.taxLabor ?? false;
  const taxableSubtotal = partsSubtotal + (taxLabor ? laborSubtotal : 0);
  const preDiscountTax = Math.round(taxableSubtotal * taxRate * 100) / 100;
  const taxAmount = rawSubtotal > 0 ? Math.round(preDiscountTax * (discountedSubtotal / rawSubtotal) * 100) / 100 : 0;
  const invoiceTotal = Math.round((discountedSubtotal + taxAmount) * 100) / 100;
  const getEstimate = () => parseFloat(ticket?.estimateAmount || "0");

  const partsCost = useMemo(() =>
    (ticket?.partsUsed || []).reduce((sum: number, p: any) => {
      const cost = parseFloat(p.unitCostSnapshot || "0");
      return sum + (cost * p.quantity);
    }, 0), [ticket?.partsUsed]);
  const internalCostsTotal = useMemo(() =>
    (ticket?.internalCosts || []).reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0), [ticket?.internalCosts]);
  const totalCost = Math.round((partsCost + internalCostsTotal) * 100) / 100;
  const grossProfit = Math.round((invoiceTotal - totalCost) * 100) / 100;
  const marginPercent = invoiceTotal > 0 ? Math.round((grossProfit / invoiceTotal) * 10000) / 100 : 0;
  const canViewProfitability = user?.merchantRole === "owner" || user?.merchantRole === "manager";
  const canManageAdditionalCosts = user?.merchantRole === "owner" || user?.merchantRole === "manager" || user?.merchantRole === "cashier";
  const canEmailReceipt = user?.merchantRole === "owner" || user?.merchantRole === "manager" || user?.merchantRole === "cashier";
  const getTotalPaid = () => (ticket?.payments || [])
    .filter((p: any) => p.status === "completed")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
  const getDepositPaid = () => (ticket?.payments || [])
    .filter((p: any) => p.paymentType === "deposit" && p.status === "completed")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
  const balanceDue = Math.max(0, Math.round((invoiceTotal - getTotalPaid()) * 100) / 100);

  const resetPaymentState = () => {
    setPaymentMethod(null);
    setPaymentAmount("");
    setCashTendered("");
    setSelectedTerminalId(null);
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const openPaymentDialog = (type: "deposit" | "final_payment") => {
    setPaymentType(type);
    resetPaymentState();
    if (type === "final_payment") {
      setPaymentAmount(balanceDue.toFixed(2));
    }
    setPaymentOpen(true);
  };

  const resendReceiptMutation = useMutation({
    mutationFn: async (params: { saleId: number; email?: string }) => {
      const body = params.email ? { email: params.email } : {};
      const res = await apiRequest("POST", `/api/merchant/sales/${params.saleId}/resend-receipt`, body);
      return res.json();
    },
    onSuccess: () => {
      setManualEmailOpen(false);
      setManualEmail("");
      toast({ title: "Receipt sent", description: "Email receipt has been sent." });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const resendNotificationMutation = useMutation({
    mutationFn: async ({ emailType, reason }: { emailType: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/merchant/tickets/${params.id}/resend-notification`, { emailType, reason });
      return res.json();
    },
    onSuccess: () => {
      setResendOpen(false);
      setResendReason("");
      setResendEmailType("");
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/notifications", "repair_ticket", String(ticket?.id)] });
      toast({ title: "Notification sent", description: "Customer notification has been resent." });
    },
    onError: (err: any) => {
      const msg = err.message || "Send failed";
      if (msg.includes("recently") || msg.includes("cooldown")) {
        toast({ title: "Resend blocked", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Send failed", description: msg, variant: "destructive" });
      }
    },
  });

  const escHtml = (s: string | null | undefined) => {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  const handleTicketPrintReceipt = (saleData: { saleNumber: string; baseAmount: string; cardUpliftAmount?: string; totalCharged: string; paymentMethod: string; paymentType: string; cardDetails?: any; authCode?: string | null; transactionRef?: string | null }) => {
    const storeName = ticket?.storeName || settingsData?.tenant?.businessName || "Receipt";
    const storeAddr = ticket?.storeAddress || "";
    const storePhone = ticket?.storePhone || "";
    const logoUrl = settings?.logoUrl || null;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const label = saleData.paymentType === "deposit" ? "Repair Deposit" : "Repair Final Payment";
    const ticketNum = ticket?.ticketNumber || "";
    const custName = ticket?.customer ? `${ticket.customer.firstName} ${ticket.customer.lastName}` : "";
    const hasUplift = saleData.cardUpliftAmount && parseFloat(saleData.cardUpliftAmount) > 0;

    const printContent = `<html><head><title>Receipt</title>
      <style>
        @page{size:80mm auto;margin:0}
        *{box-sizing:border-box;margin:0;padding:0}
        html{height:auto!important;min-height:0!important}
        body{font-family:'Courier New',Courier,monospace;width:72mm;max-width:72mm;margin:0 auto;padding:4mm 3mm 2mm;font-size:11px;line-height:1.3;color:#000;height:auto!important;min-height:0!important}
        h2{text-align:center;margin:0 0 1px;font-size:14px;font-weight:bold}
        .center{text-align:center;font-size:10px;margin:1px 0;line-height:1.2}
        .line{display:flex;justify-content:space-between;margin:2px 0;font-size:11px;gap:4px}
        .line span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .line span:last-child{flex-shrink:0;text-align:right}
        hr{border:none;border-top:1px dashed #000;margin:4px 0}
        .total{font-weight:bold;font-size:13px}
        .footer{text-align:center;font-size:9px;margin-top:6px;margin-bottom:0;color:#666}
        @media print{html,body{width:72mm;max-width:72mm;margin:0;padding:4mm 3mm 2mm;height:auto!important;min-height:0!important}@page{size:80mm auto;margin:0}}
      </style></head><body>
      ${logoUrl ? `<div style="text-align:center;margin-bottom:4px"><img src="${escHtml(logoUrl)}" alt="" style="max-width:40mm;max-height:15mm;object-fit:contain" /></div>` : ""}
      <h2>${escHtml(storeName)}</h2>
      ${storeAddr ? `<p class="center">${escHtml(storeAddr)}</p>` : ""}
      ${storePhone ? `<p class="center">${escHtml(storePhone)}</p>` : ""}
      <hr/>
      <div class="line"><span>Sale #</span><span>${escHtml(saleData.saleNumber)}</span></div>
      <div class="line"><span>Ticket #</span><span>${escHtml(ticketNum)}</span></div>
      <div class="line"><span>Date</span><span>${dateStr} ${timeStr}</span></div>
      ${custName ? `<div class="line"><span>Customer</span><span>${escHtml(custName)}</span></div>` : ""}
      <hr/>
      <div class="line"><span>${escHtml(label)}</span><span>$${escHtml(saleData.baseAmount)}</span></div>
      ${hasUplift ? `<div class="line"><span>Card Surcharge</span><span>+$${escHtml(saleData.cardUpliftAmount!)}</span></div>` : ""}
      <hr/>
      <div class="line total"><span>TOTAL</span><span>$${escHtml(saleData.totalCharged)}</span></div>
      <hr/>
      <div class="line"><span>Payment</span><span>${saleData.paymentMethod === "card" ? "Card" : "Cash"}</span></div>
      ${saleData.cardDetails?.cardBrand ? `<div class="line"><span>Card</span><span>${escHtml(saleData.cardDetails.cardBrand)} ****${escHtml(saleData.cardDetails.cardLast4)}</span></div>` : ""}
      ${saleData.transactionRef ? `<div class="line"><span>Ref #</span><span>${escHtml(saleData.transactionRef)}</span></div>` : ""}
      <div class="line"><span>Status</span><span>COMPLETED</span></div>
      <hr/>
      <p class="footer">Thank you for your business!</p>
      </body></html>`;
    const printWin = window.open("", "_blank", "width=320,height=100");
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.onafterprint = () => printWin.close();
      }, 250);
    }
  };

  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const dualPricingEnabled = settings?.dualPricingEnabled ?? false;
  const cardUpliftPercent = dualPricingEnabled ? parseFloat(settings?.cardUpliftPercent || "0") : 0;
  const cardUpliftOnPayment = cardUpliftPercent > 0 ? Math.round(parsedPaymentAmount * (cardUpliftPercent / 100) * 100) / 100 : 0;
  const cardTotalOnPayment = Math.round((parsedPaymentAmount + cardUpliftOnPayment) * 100) / 100;
  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, Math.round((cashTenderedNum - parsedPaymentAmount) * 100) / 100);
  const quickTenders = useMemo(() => {
    const t = parsedPaymentAmount;
    if (t <= 0) return [];
    const amounts = new Set<number>();
    amounts.add(Math.ceil(t));
    amounts.add(Math.ceil(t / 5) * 5);
    amounts.add(Math.ceil(t / 10) * 10);
    amounts.add(Math.ceil(t / 20) * 20);
    if (t <= 50) amounts.add(50);
    if (t <= 100) amounts.add(100);
    const sorted = Array.from(amounts).filter(a => a >= t).sort((a, b) => a - b);
    return sorted.slice(0, 5);
  }, [parsedPaymentAmount]);

  const startEdit = () => {
    if (!ticket) return;
    setEditFields({
      assignedEmployeeId: ticket.assignedEmployeeId?.toString() || "",
      estimateAmount: ticket.estimateAmount || "",
      estimatedCompletionDate: ticket.estimatedCompletionDate ? format(new Date(ticket.estimatedCompletionDate), "yyyy-MM-dd") : "",
      intakeNotes: ticket.intakeNotes || "",
      brand: ticket.brand || "",
      model: ticket.model || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const data: any = {};
    const empId = parseInt(editFields.assignedEmployeeId);
    data.assignedEmployeeId = isNaN(empId) ? null : empId;
    if (editFields.estimateAmount) data.estimateAmount = editFields.estimateAmount;
    if (editFields.estimatedCompletionDate) data.estimatedCompletionDate = editFields.estimatedCompletionDate;
    data.intakeNotes = editFields.intakeNotes || null;
    data.brand = editFields.brand || null;
    data.model = editFields.model || null;
    editMutation.mutate(data);
  };

  if (isLoading) {
    return <MerchantLayout><div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div></MerchantLayout>;
  }

  if (!ticket) {
    return <MerchantLayout><p className="text-muted-foreground">Ticket not found</p></MerchantLayout>;
  }

  const isReadyForPickup = ticket.status === "ready_for_pickup";

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app/tickets">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-ticket-number">{ticket.ticketNumber}</h1>
              <Badge className={`text-xs ${statusColors[ticket.status]}`} variant="secondary">{statusLabel(ticket.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{ticket.brand} {ticket.model}</p>
          </div>
          {canEdit && !isTerminal && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-ticket">
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ MAIN COLUMN ═══ */}
          <div className="lg:col-span-2 space-y-4">
            {/* 1. Device & Issue */}
            <Card className="border-card-border">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" /> Device & Issue</CardTitle></CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="text-xs text-muted-foreground">Device Type</div><div className="text-sm font-medium">{ticket.deviceType}</div></div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Brand</Label>
                        <Input value={editFields.brand} onChange={e => setEditFields({ ...editFields, brand: e.target.value })} data-testid="input-edit-brand" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Model</Label>
                        <Input value={editFields.model} onChange={e => setEditFields({ ...editFields, model: e.target.value })} data-testid="input-edit-model" />
                      </div>
                      <div><div className="text-xs text-muted-foreground">Serial / IMEI</div><div className="text-sm font-medium">{ticket.serialNumber || ticket.imei || "—"}</div></div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Issue Description</div>
                      <div className="text-sm">{ticket.issueDescription}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Intake Notes</Label>
                      <Textarea value={editFields.intakeNotes} onChange={e => setEditFields({ ...editFields, intakeNotes: e.target.value })} data-testid="input-edit-intake-notes" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="text-xs text-muted-foreground">Device Type</div><div className="text-sm font-medium">{ticket.deviceType}</div></div>
                      <div><div className="text-xs text-muted-foreground">Brand</div><div className="text-sm font-medium">{ticket.brand || "—"}</div></div>
                      <div><div className="text-xs text-muted-foreground">Model</div><div className="text-sm font-medium">{ticket.model || "—"}</div></div>
                      <div><div className="text-xs text-muted-foreground">Serial / IMEI</div><div className="text-sm font-medium">{ticket.serialNumber || ticket.imei || "—"}</div></div>
                    </div>
                    <Separator className="my-4" />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Issue Description</div>
                      <div className="text-sm">{ticket.issueDescription}</div>
                    </div>
                    {ticket.intakeNotes && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">Intake Notes</div>
                        <div className="text-sm text-muted-foreground">{ticket.intakeNotes}</div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 2. Invoice Summary */}
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Invoice Summary</CardTitle>
                  {!isTerminal && (balanceDue > 0 || (!isReadyForPickup && getEstimate() > 0 && getTotalPaid() < getEstimate())) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPaymentDialog(isReadyForPickup ? "final_payment" : "deposit")}
                      data-testid="button-collect-payment"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      {isReadyForPickup ? "Collect Final Payment" : "Collect Deposit"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Quoted Estimate</span>
                    <span className="tabular-nums italic">${getEstimate().toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Parts Subtotal</span>
                    <span className="tabular-nums">${partsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Labor Subtotal</span>
                    <span className="tabular-nums">${laborSubtotal.toFixed(2)}</span>
                  </div>
                  {ticketDiscountAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>
                        Discount
                        {ticket.discountType === "percent"
                          ? ` (${ticket.discountValue}% of $${rawSubtotal.toFixed(2)})`
                          : ` ($${parseFloat(ticket.discountValue || "0").toFixed(2)} off)`}
                      </span>
                      <span className="tabular-nums">-${ticketDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {ticketDiscountAmount > 0 && ticket.discountReason && (
                    <div className="text-xs text-muted-foreground ml-1 flex items-center gap-1 flex-wrap">
                      <span>"{ticket.discountReason}"</span>
                      {ticket.discountAppliedByName && <span>— {ticket.discountAppliedByName}</span>}
                      {ticket.discountAppliedAt && <span>({format(new Date(ticket.discountAppliedAt), "MMM d")})</span>}
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</span>
                      <span className="tabular-nums">${taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Invoice Total</span>
                    <span className="tabular-nums" data-testid="text-invoice-total">${invoiceTotal.toFixed(2)}</span>
                  </div>
                  {canDiscount && !isTerminal && rawSubtotal > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      {ticketDiscountAmount > 0 ? (
                        <div className="flex gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => { setDiscountType((ticket.discountType || "percent") as "percent" | "fixed"); setDiscountValue(ticket.discountValue || ""); setDiscountReason(ticket.discountReason || ""); setDiscountOpen(true); }}
                            data-testid="button-edit-discount"
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit Discount
                          </Button>
                          {user?.merchantRole === "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700"
                              onClick={() => removeDiscountMutation.mutate()}
                              disabled={removeDiscountMutation.isPending}
                              data-testid="button-remove-discount"
                            >
                              {removeDiscountMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              Remove
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => { setDiscountType("percent"); setDiscountValue(""); setDiscountReason(""); setDiscountOpen(true); }}
                          data-testid="button-apply-discount"
                        >
                          <DollarSign className="w-3 h-3 mr-1" /> Apply Discount
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="text-xs text-muted-foreground">Deposit Paid</div>
                    <div className="text-lg font-semibold text-green-700 dark:text-green-400 tabular-nums" data-testid="text-deposit-paid">${getDepositPaid().toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-xs text-muted-foreground">Total Paid</div>
                    <div className="text-lg font-semibold text-blue-700 dark:text-blue-400 tabular-nums" data-testid="text-total-paid">${getTotalPaid().toFixed(2)}</div>
                  </div>
                  <div className={`p-3 rounded-lg ${balanceDue > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                    <div className="text-xs text-muted-foreground">Balance Due</div>
                    <div className={`text-lg font-semibold tabular-nums ${balanceDue > 0 ? "text-orange-700 dark:text-orange-400" : "text-green-700 dark:text-green-400"}`} data-testid="text-balance-due">
                      ${balanceDue.toFixed(2)}
                    </div>
                  </div>
                </div>

                {ticket.payments && ticket.payments.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="text-xs font-medium text-muted-foreground mb-2">Payment History</div>
                    <div className="space-y-2">
                      {ticket.payments.map((p: any) => (
                        <div key={p.id} className="py-2 border-b border-border last:border-0" data-testid={`payment-row-${p.id}`}>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {p.paymentMethod === "cash" ? <Banknote className="w-3.5 h-3.5 text-green-600" /> : <CreditCard className="w-3.5 h-3.5 text-blue-600" />}
                              <span className="capitalize">{p.paymentType.replace(/_/g, " ")}</span>
                              <Badge variant="secondary" className="text-xs capitalize">{p.paymentMethod}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="font-medium tabular-nums">${parseFloat(p.amount).toFixed(2)}</span>
                                {p.cardUpliftAmount && parseFloat(p.cardUpliftAmount) > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">(+${parseFloat(p.cardUpliftAmount).toFixed(2)} surcharge)</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {p.createdAt ? format(new Date(p.createdAt), "MMM d, h:mm a") : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 ml-5">
                            {p.reference && (
                              <Link href={`/app/sales/${p.saleId}`}>
                                <span className="text-xs text-primary hover:underline cursor-pointer font-medium" data-testid={`link-sale-${p.id}`}>#{p.reference}</span>
                              </Link>
                            )}
                            {p.saleId && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleTicketPrintReceipt({
                                    saleNumber: p.reference || "",
                                    baseAmount: parseFloat(p.amount).toFixed(2),
                                    cardUpliftAmount: p.cardUpliftAmount,
                                    totalCharged: p.totalCharged || parseFloat(p.amount).toFixed(2),
                                    paymentMethod: p.paymentMethod,
                                    paymentType: p.paymentType,
                                    cardDetails: p.cardBrand ? { cardBrand: p.cardBrand, cardLast4: p.cardLast4 } : undefined,
                                    transactionRef: p.transactionRef || null,
                                  })}
                                  data-testid={`button-print-${p.id}`}
                                >
                                  <Printer className="w-3 h-3 mr-1" /> Print
                                </Button>
                                {canEmailReceipt && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    disabled={resendReceiptMutation.isPending}
                                    onClick={() => {
                                      if (ticket.customer?.email) {
                                        resendReceiptMutation.mutate({ saleId: p.saleId });
                                      } else {
                                        setManualEmailSaleId(p.saleId);
                                        setManualEmailOpen(true);
                                      }
                                    }}
                                    data-testid={`button-email-${p.id}`}
                                  >
                                    {resendReceiptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                                    Email
                                  </Button>
                                )}
                                <Link href={`/app/sales/${p.saleId}`}>
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`button-view-sale-${p.id}`}>
                                    <Eye className="w-3 h-3 mr-1" /> View Sale
                                  </Button>
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 3. Parts */}
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Parts</CardTitle>
                  {canAddParts && !isTerminal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddPartOpen(!addPartOpen); setPartSearch(""); setPartCategoryFilter("all"); setSelectedProductId(""); setCustomPartMode(false); setCustomPartDesc(""); setCustomPartPrice(""); setCustomPartCost(""); }}
                      data-testid="button-add-part"
                    >
                      {addPartOpen ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      {addPartOpen ? "Cancel" : "Add Part"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {addPartOpen && (
                  <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${!customPartMode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setCustomPartMode(false)}
                        data-testid="tab-inventory-part"
                      >
                        From Inventory
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${customPartMode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setCustomPartMode(true)}
                        data-testid="tab-custom-part"
                      >
                        Custom Part
                      </button>
                    </div>

                    {!customPartMode ? (
                      <>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, SKU, or barcode..."
                              value={partSearch}
                              onChange={e => setPartSearch(e.target.value)}
                              className="pl-8"
                              data-testid="input-part-search"
                            />
                          </div>
                          <Select value={partCategoryFilter} onValueChange={setPartCategoryFilter}>
                            <SelectTrigger className="w-40" data-testid="select-part-category">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categories.filter((c: any) => c.isActive).map((c: any) => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Product *</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                            <SelectTrigger data-testid="select-part-product">
                              <SelectValue placeholder={`Select from ${filteredProducts.length} products...`} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredProducts.map((p: any) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  <div className="flex items-center justify-between w-full gap-3">
                                    <span>{p.name} {p.sku ? `(${p.sku})` : ""}</span>
                                    <span className="text-muted-foreground text-xs">
                                      ${p.cashPrice}{p.trackInventory ? ` · ${p.quantityOnHand} in stock` : ""}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                              {filteredProducts.length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-3">No products match your search</div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label className="text-xs">Part Description *</Label>
                          <Input
                            placeholder="e.g. iPhone 12 Screen Assembly"
                            value={customPartDesc}
                            onChange={e => setCustomPartDesc(e.target.value)}
                            data-testid="input-custom-part-desc"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Price (charge to customer) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={customPartPrice}
                              onChange={e => setCustomPartPrice(e.target.value)}
                              data-testid="input-custom-part-price"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Cost (your cost) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={customPartCost}
                              onChange={e => setCustomPartCost(e.target.value)}
                              data-testid="input-custom-part-cost"
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={partQuantity}
                          onChange={(e) => setPartQuantity(e.target.value)}
                          data-testid="input-part-quantity"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => addPartMutation.mutate()}
                          disabled={(customPartMode ? !customPartDesc.trim() || !customPartPrice || !customPartCost : !selectedProductId) || addPartMutation.isPending}
                          data-testid="button-submit-part"
                        >
                          {addPartMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {ticket.partsUsed?.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No parts added yet</p>
                ) : (
                  <div className="space-y-1">
                    {ticket.partsUsed?.map((part: any) => (
                      <div key={part.id} className="flex items-center justify-between text-sm py-2 px-1 border-b border-border last:border-0 group" data-testid={`part-row-${part.id}`}>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{part.productName || part.customDescription || (part.productId ? `Product #${part.productId}` : "Custom Part")}</span>
                          {part.unitCostSnapshot != null && (
                            <span className="text-xs text-muted-foreground ml-2">(cost: ${parseFloat(part.unitCostSnapshot).toFixed(2)})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground tabular-nums">{part.quantity} × ${parseFloat(part.unitPrice).toFixed(2)}</span>
                          <span className="font-medium tabular-nums w-20 text-right">${(part.quantity * parseFloat(part.unitPrice)).toFixed(2)}</span>
                          {canEdit && !isTerminal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                              onClick={() => deletePartMutation.mutate(part.id)}
                              disabled={deletePartMutation.isPending}
                              data-testid={`button-delete-part-${part.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium pt-2">
                      <span>Parts Subtotal</span>
                      <span className="tabular-nums" data-testid="text-parts-subtotal">${partsSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. Labor */}
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Labor</CardTitle>
                  {canEdit && !isTerminal && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddLaborOpen(!addLaborOpen); setLaborDescription(""); setLaborAmount(""); }}
                      data-testid="button-add-labor"
                    >
                      {addLaborOpen ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      {addLaborOpen ? "Cancel" : "Add Labor"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {addLaborOpen && (
                  <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div>
                      <Label className="text-xs">Description *</Label>
                      <Input
                        placeholder="e.g. Screen replacement labor"
                        value={laborDescription}
                        onChange={e => setLaborDescription(e.target.value)}
                        data-testid="input-labor-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Amount *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={laborAmount}
                            onChange={e => setLaborAmount(e.target.value)}
                            className="pl-8"
                            data-testid="input-labor-amount"
                          />
                        </div>
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => addLaborMutation.mutate()}
                          disabled={!laborDescription.trim() || !laborAmount || parseFloat(laborAmount) <= 0 || addLaborMutation.isPending}
                          data-testid="button-submit-labor"
                        >
                          {addLaborMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {(ticket.laborLines || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No labor charges</p>
                ) : (
                  <div className="space-y-1">
                    {(ticket.laborLines || []).map((labor: any) => (
                      <div key={labor.id} className="group" data-testid={`labor-row-${labor.id}`}>
                        {editingLaborId === labor.id ? (
                          <div className="flex items-center gap-2 py-1.5">
                            <Input
                              value={editLaborDesc}
                              onChange={e => setEditLaborDesc(e.target.value)}
                              className="flex-1 h-8 text-sm"
                              data-testid={`input-edit-labor-desc-${labor.id}`}
                            />
                            <div className="relative w-24">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                value={editLaborAmount}
                                onChange={e => setEditLaborAmount(e.target.value)}
                                className="pl-6 h-8 text-sm"
                                data-testid={`input-edit-labor-amount-${labor.id}`}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => updateLaborMutation.mutate({ id: labor.id, description: editLaborDesc, amount: editLaborAmount })}
                              disabled={updateLaborMutation.isPending}
                              data-testid={`button-save-labor-${labor.id}`}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingLaborId(null)}
                              data-testid={`button-cancel-labor-${labor.id}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-sm py-2 px-1 border-b border-border last:border-0">
                            <span className="font-medium flex-1">{labor.description}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-medium tabular-nums w-20 text-right">${parseFloat(labor.amount).toFixed(2)}</span>
                              {canEdit && !isTerminal && (
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setEditingLaborId(labor.id); setEditLaborDesc(labor.description); setEditLaborAmount(labor.amount); }}
                                    data-testid={`button-edit-labor-${labor.id}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                    onClick={() => deleteLaborMutation.mutate(labor.id)}
                                    disabled={deleteLaborMutation.isPending}
                                    data-testid={`button-delete-labor-${labor.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium pt-2">
                      <span>Labor Subtotal</span>
                      <span className="tabular-nums" data-testid="text-labor-subtotal">${laborSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {canManageAdditionalCosts && (
              <Card className="border-card-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4" /> Outsourced & Internal Costs</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Shop expenses not billed to the customer (e.g. outsourced repairs, shipping)</p>
                  </div>
                  {canEdit && !isTerminal && (
                    <Button size="sm" variant="outline" onClick={() => setAddInternalCostOpen(!addInternalCostOpen)} data-testid="button-toggle-internal-cost">
                      <Plus className="w-4 h-4 mr-1" /> Add Cost
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {addInternalCostOpen && (
                    <div className="space-y-3 mb-4 p-3 bg-muted/50 rounded-lg border border-dashed border-border">
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          placeholder="e.g. Outsourced microsoldering, shipping"
                          value={internalCostDescription}
                          onChange={e => setInternalCostDescription(e.target.value)}
                          data-testid="input-internal-cost-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Amount</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="number" step="0.01" min="0" placeholder="0.00"
                              className="pl-7"
                              value={internalCostAmount}
                              onChange={e => setInternalCostAmount(e.target.value)}
                              data-testid="input-internal-cost-amount"
                            />
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            size="sm" className="flex-1"
                            onClick={() => addInternalCostMutation.mutate()}
                            disabled={!internalCostDescription.trim() || !internalCostAmount || addInternalCostMutation.isPending}
                            data-testid="button-add-internal-cost"
                          >
                            {addInternalCostMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddInternalCostOpen(false)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {(ticket.internalCosts || []).length === 0 && !addInternalCostOpen ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No outsourced or internal costs</p>
                  ) : (
                    <div className="space-y-0">
                      {(ticket.internalCosts || []).map((cost: any) => (
                        <div key={cost.id} className="group">
                          {editingCostId === cost.id ? (
                            <div className="flex items-center gap-2 py-2 px-1 border-b border-border last:border-0">
                              <Input
                                value={editCostDesc}
                                onChange={e => setEditCostDesc(e.target.value)}
                                className="h-8 text-sm flex-1"
                                data-testid={`input-edit-cost-desc-${cost.id}`}
                              />
                              <div className="relative w-24">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={editCostAmount}
                                  onChange={e => setEditCostAmount(e.target.value)}
                                  className="h-8 text-sm pl-6 tabular-nums"
                                  data-testid={`input-edit-cost-amount-${cost.id}`}
                                />
                              </div>
                              <Button
                                variant="ghost" size="sm" className="h-8 w-8 p-0"
                                onClick={() => updateInternalCostMutation.mutate({ id: cost.id, description: editCostDesc, amount: editCostAmount })}
                                disabled={updateInternalCostMutation.isPending}
                                data-testid={`button-save-cost-${cost.id}`}
                              >
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-8 w-8 p-0"
                                onClick={() => setEditingCostId(null)}
                                data-testid={`button-cancel-cost-${cost.id}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-sm py-2 px-1 border-b border-border last:border-0">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{cost.description}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {cost.createdByName && <span>{cost.createdByName}</span>}
                                  {cost.createdAt && (
                                    <span>{format(new Date(cost.createdAt), "MMM d, h:mm a")}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-medium tabular-nums w-20 text-right">${parseFloat(cost.amount).toFixed(2)}</span>
                                {canManageAdditionalCosts && !isTerminal && (
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => { setEditingCostId(cost.id); setEditCostDesc(cost.description); setEditCostAmount(cost.amount); }}
                                      data-testid={`button-edit-cost-${cost.id}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                      onClick={() => deleteInternalCostMutation.mutate(cost.id)}
                                      disabled={deleteInternalCostMutation.isPending}
                                      data-testid={`button-delete-cost-${cost.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {(ticket.internalCosts || []).length > 0 && (
                        <div className="flex justify-between text-sm font-medium pt-2">
                          <span>Outsourced & Internal Costs Total</span>
                          <span className="tabular-nums" data-testid="text-internal-costs-total">${internalCostsTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canViewProfitability && (
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Profitability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parts Cost</span>
                      <span className="tabular-nums" data-testid="text-parts-cost">${partsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outsourced & Internal Costs</span>
                      <span className="tabular-nums" data-testid="text-additional-costs">${internalCostsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-border pt-2">
                      <span>Total Cost</span>
                      <span className="tabular-nums" data-testid="text-total-cost">${totalCost.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Invoice Total</span>
                      <span className="tabular-nums">${invoiceTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-1">
                      <span>Gross Profit</span>
                      <span className={`tabular-nums ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-gross-profit">
                        {grossProfit >= 0 ? "" : "-"}${Math.abs(grossProfit).toFixed(2)}
                      </span>
                    </div>
                    {invoiceTotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margin</span>
                        <span className={`font-medium ${marginPercent >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-margin-percent">
                          {marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. Notes */}
            <Card className="border-card-border">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Notes{ticket.notes?.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{ticket.notes.length}</Badge>}</CardTitle></CardHeader>
              <CardContent>
                {ticket.notes?.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {ticket.notes?.map((note: any) => (
                      <div key={note.id} className="p-2.5 rounded-lg text-sm bg-muted/60">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-xs">
                            {note.userName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {note.createdAt ? format(new Date(note.createdAt), "MMM d, h:mm a") : ""}
                          </span>
                        </div>
                        <p className="text-sm leading-snug">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-start">
                  <Textarea
                    placeholder="Add a note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={2}
                    className="min-h-0 text-sm resize-none"
                    data-testid="input-note"
                  />
                  <Button size="sm" className="shrink-0" aria-label="Add note" onClick={() => noteMutation.mutate()} disabled={!noteContent.trim() || noteMutation.isPending} data-testid="button-add-note">
                    {noteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="space-y-4">
            {/* 1. Status & Actions */}
            <Card className="border-card-border">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Status & Actions</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current Status</Label>
                  <Badge className={`text-sm px-3 py-1 ${statusColors[ticket.status]}`} variant="secondary">{statusLabel(ticket.status)}</Badge>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned Technician</Label>
                      <Select value={editFields.assignedEmployeeId} onValueChange={v => setEditFields({ ...editFields, assignedEmployeeId: v })}>
                        <SelectTrigger data-testid="select-edit-tech"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {technicians.map((e: any) => <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Estimate</Label>
                      <Input type="number" step="0.01" value={editFields.estimateAmount} onChange={e => setEditFields({ ...editFields, estimateAmount: e.target.value })} data-testid="input-edit-estimate" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Est. Completion</Label>
                      <Input type="date" value={editFields.estimatedCompletionDate} onChange={e => setEditFields({ ...editFields, estimatedCompletionDate: e.target.value })} data-testid="input-edit-date" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={saveEdit} disabled={editMutation.isPending} data-testid="button-save-edit">
                        {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit"><X className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Assigned</span><span>{ticket.assignedEmployeeName || "Unassigned"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Estimate</span><span className="tabular-nums">${getEstimate().toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(ticket.createdAt), "MMM d, yyyy")}</span></div>
                      {ticket.estimatedCompletionDate && <div className="flex justify-between"><span className="text-muted-foreground">Est. Completion</span><span>{format(new Date(ticket.estimatedCompletionDate), "MMM d, yyyy")}</span></div>}
                    </div>

                    <Separator />

                    {/* Context-aware action buttons */}
                    <div className="space-y-2">
                      {ticket.status === "new" && (
                        <>
                          <Button
                            className="w-full"
                            onClick={() => statusMutation.mutate("in_progress")}
                            disabled={statusMutation.isPending}
                            data-testid="button-start-repair"
                          >
                            {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
                            Start Repair
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => statusMutation.mutate("cancelled")}
                            disabled={statusMutation.isPending}
                            data-testid="button-cancel-ticket"
                          >
                            <Ban className="w-4 h-4 mr-1" /> Cancel Ticket
                          </Button>
                        </>
                      )}

                      {ticket.status === "in_progress" && (
                        <>
                          <Button
                            className="w-full"
                            onClick={() => statusMutation.mutate("ready_for_pickup")}
                            disabled={statusMutation.isPending}
                            data-testid="button-mark-ready"
                          >
                            {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                            Mark Ready for Pickup
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => statusMutation.mutate("cancelled")}
                            disabled={statusMutation.isPending}
                            data-testid="button-cancel-ticket"
                          >
                            <Ban className="w-4 h-4 mr-1" /> Cancel Ticket
                          </Button>
                        </>
                      )}

                      {ticket.status === "ready_for_pickup" && (
                        <>
                          {balanceDue > 0 ? (
                            <Button
                              className="w-full"
                              onClick={() => openPaymentDialog("final_payment")}
                              data-testid="button-collect-pickup-payment"
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              Collect Payment & Pick Up (${balanceDue.toFixed(2)})
                            </Button>
                          ) : (
                            <Button
                              className="w-full"
                              onClick={() => setPickupOpen(true)}
                              disabled={pickupMutation.isPending}
                              data-testid="button-pickup"
                            >
                              {pickupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                              Mark Picked Up
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => statusMutation.mutate("cancelled")}
                            disabled={statusMutation.isPending}
                            data-testid="button-cancel-ticket"
                          >
                            <Ban className="w-4 h-4 mr-1" /> Cancel Ticket
                          </Button>
                        </>
                      )}

                      {ticket.status === "picked_up" && (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">This ticket is complete.</p>
                        </div>
                      )}

                      {ticket.status === "cancelled" && (
                        <div className="text-center py-2">
                          <p className="text-sm text-muted-foreground">This ticket was cancelled.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 2. Customer */}
            {ticket.customer && (
              <Card className="border-card-border">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Customer</CardTitle></CardHeader>
                <CardContent>
                  <Link href={`/app/customers/${ticket.customerId}`}>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ticket.customer.firstName} {ticket.customer.lastName}</p>
                        {ticket.customer.phone && <p className="text-xs text-muted-foreground">{ticket.customer.phone}</p>}
                        {ticket.customer.email && <p className="text-xs text-muted-foreground">{ticket.customer.email}</p>}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            <NotificationStatusCard entityType="repair_ticket" entityId={ticket.id} />

            {(user?.merchantRole === "owner" || user?.merchantRole === "manager") && ticket.customer?.email && (
              <Card className="border-card-border" data-testid="ticket-resend-card">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Resend Notification
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-muted-foreground">Resend a ticket notification to the customer on file. A 5-minute cooldown applies between sends.</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setResendEmailType("ticket_created"); setResendOpen(true); }} data-testid="button-resend-ticket-created">
                      Ticket Created
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setResendEmailType("ticket_status_update"); setResendOpen(true); }} data-testid="button-resend-status-update">
                      Status Update
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setResendEmailType("ready_for_pickup"); setResendOpen(true); }} data-testid="button-resend-ready-pickup">
                      Ready for Pickup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Ticket Details */}
            <Card className="border-card-border">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Ticket Details</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Ticket #</span><span className="font-medium">{ticket.ticketNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Store</span><span>{ticket.storeName || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}</span></div>
                  {ticket.actualCompletionDate && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{format(new Date(ticket.actualCompletionDate), "MMM d, yyyy")}</span></div>}
                  {ticket.estimatedCompletionDate && <div className="flex justify-between"><span className="text-muted-foreground">Est. Completion</span><span>{format(new Date(ticket.estimatedCompletionDate), "MMM d, yyyy")}</span></div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Dialog (Deposit or Final Payment) */}
      <Dialog open={paymentOpen} onOpenChange={(open) => { if (!open) { setPaymentOpen(false); resetPaymentState(); } }}>
        <DialogContent className="sm:max-w-md">
          {!paymentSuccess && (
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {paymentType === "deposit" ? "Collect Deposit" : "Collect Final Payment"}
              </DialogTitle>
            </DialogHeader>
          )}

          {/* Payment Success State */}
          {paymentSuccess && !paymentMutation.isPending && (
            <div className="py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold mb-1" data-testid="text-payment-success">
                {paymentSuccess.paymentType === "deposit" ? "Deposit Collected!" : "Payment Complete!"}
              </h2>
              <p className="text-muted-foreground text-sm mb-4">Transaction processed successfully</p>
              <div className="space-y-2 text-sm text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">Sale #</span><span className="font-medium">{paymentSuccess.saleNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ticket #</span><span className="font-medium">{ticket?.ticketNumber}</span></div>
                <Separator />
                {paymentSuccess.cardUpliftAmount && parseFloat(paymentSuccess.cardUpliftAmount) > 0 ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount Collected</span><span className="font-medium">${paymentSuccess.baseAmount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Card Surcharge</span><span className="font-medium">+${paymentSuccess.cardUpliftAmount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Charged</span><span className="font-bold text-lg">${paymentSuccess.totalCharged}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount Collected</span><span className="font-bold text-lg">${paymentSuccess.totalCharged}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><span className="font-medium capitalize">{paymentSuccess.paymentMethod === "card" ? "Card" : "Cash"}</span></div>
                {dualPricingEnabled && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Pricing Mode</span><span className="font-medium">{paymentSuccess.paymentMethod === "card" ? "Card Rate" : "Cash Rate"}</span></div>
                )}
                {paymentSuccess.cardDetails?.cardBrand && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Card</span>
                    <span className="font-medium">{paymentSuccess.cardDetails.cardBrand} ****{paymentSuccess.cardDetails.cardLast4}</span>
                  </div>
                )}
                {paymentSuccess.cardDetails?.entryMode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry</span>
                    <span className="font-medium capitalize">{paymentSuccess.cardDetails.entryMode}</span>
                  </div>
                )}
              </div>
              <div className={`grid ${canEmailReceipt ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-4`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTicketPrintReceipt(paymentSuccess)}
                  data-testid="button-print-receipt"
                >
                  <Printer className="w-4 h-4 mr-1" /> Print Receipt
                </Button>
                {canEmailReceipt && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resendReceiptMutation.isPending}
                    onClick={() => {
                      if (paymentSuccess.customerEmail && paymentSuccess.saleId) {
                        resendReceiptMutation.mutate({ saleId: paymentSuccess.saleId });
                      } else if (paymentSuccess.saleId) {
                        setManualEmailSaleId(paymentSuccess.saleId);
                        setManualEmailOpen(true);
                      }
                    }}
                    data-testid="button-email-receipt"
                  >
                    {resendReceiptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
                    Email Receipt
                  </Button>
                )}
              </div>
              {paymentSuccess.customerEmail && (
                <p className="text-xs text-muted-foreground mt-1">Will send to {paymentSuccess.customerEmail}</p>
              )}
              {paymentSuccess.saleId && (
                <Link href={`/app/sales/${paymentSuccess.saleId}`}>
                  <Button variant="ghost" size="sm" className="mt-2 text-xs" data-testid="button-view-sale">
                    <Eye className="w-3.5 h-3.5 mr-1" /> View Sale #{paymentSuccess.saleNumber}
                  </Button>
                </Link>
              )}
              <Button className="w-full mt-4" onClick={() => { setPaymentOpen(false); resetPaymentState(); }} data-testid="button-done">
                Done
              </Button>
            </div>
          )}

          {!paymentMutation.isPending && !paymentError && !paymentSuccess && !paymentMethod && (
            <div className="space-y-4">
              {paymentType === "deposit" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-8 h-12 text-lg font-semibold tabular-nums text-center"
                      placeholder="0.00"
                      data-testid="input-deposit-amount"
                    />
                  </div>
                  {dualPricingEnabled && parsedPaymentAmount > 0 && (
                    <p className="text-sm text-amber-600 tabular-nums text-center mt-2">${cardTotalOnPayment.toFixed(2)} if paying by card</p>
                  )}
                </div>
              )}

              {paymentType === "final_payment" && (
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
                  <p className="text-3xl font-bold tabular-nums text-orange-700 dark:text-orange-400" data-testid="text-final-amount">${parsedPaymentAmount.toFixed(2)}</p>
                  {dualPricingEnabled && parsedPaymentAmount > 0 && (
                    <p className="text-sm text-amber-600 tabular-nums mt-2">${cardTotalOnPayment.toFixed(2)} if paying by card</p>
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPaymentMethod("cash"); setCashTendered(""); }}
                    disabled={parsedPaymentAmount <= 0}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    data-testid="button-method-cash"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium">Cash</span>
                    {parsedPaymentAmount > 0 && (
                      <span className="text-sm font-bold tabular-nums text-green-700 dark:text-green-400">${parsedPaymentAmount.toFixed(2)}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod("card");
                      setSelectedTerminalId(terminalStatus?.terminalId ?? null);
                    }}
                    disabled={parsedPaymentAmount <= 0}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    data-testid="button-method-card"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium">Card</span>
                    {parsedPaymentAmount > 0 && (
                      <span className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-400">${cardTotalOnPayment.toFixed(2)}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cash Tender Flow */}
          {!paymentMutation.isPending && !paymentError && !paymentSuccess && paymentMethod === "cash" && (
            <div className="space-y-4">
              <button onClick={() => setPaymentMethod(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" data-testid="button-back-method">
                ← Back to payment method
              </button>

              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                <p className="text-xs text-muted-foreground mb-0.5">Cash Due</p>
                <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">${parsedPaymentAmount.toFixed(2)}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Quick Tender</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCashTendered(parsedPaymentAmount.toFixed(2))}
                    className="h-10 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                    data-testid="button-tender-exact"
                  >
                    Exact
                  </button>
                  {quickTenders.filter(a => a !== parsedPaymentAmount).map(amount => (
                    <button
                      key={amount}
                      onClick={() => setCashTendered(amount.toFixed(2))}
                      className="h-10 rounded-lg border border-border font-semibold text-sm hover:bg-muted transition-colors tabular-nums"
                      data-testid={`button-tender-${amount}`}
                    >
                      ${amount.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Cash Received</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="pl-8 h-12 text-lg font-semibold tabular-nums text-center"
                    placeholder="0.00"
                    data-testid="input-cash-tendered"
                  />
                </div>
              </div>

              {cashTenderedNum > 0 && cashTenderedNum >= parsedPaymentAmount && (
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-0.5">Change Due</p>
                  <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400" data-testid="text-change-due">${changeDue.toFixed(2)}</p>
                </div>
              )}

              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={cashTenderedNum < parsedPaymentAmount || paymentMutation.isPending}
                onClick={() => paymentMutation.mutate()}
                data-testid="button-confirm-cash"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirm Cash Payment
              </Button>
            </div>
          )}

          {/* Card Payment Flow */}
          {!paymentMutation.isPending && !paymentError && !paymentSuccess && paymentMethod === "card" && (
            <div className="space-y-4">
              <button onClick={() => setPaymentMethod(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" data-testid="button-back-method-card">
                ← Back to payment method
              </button>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                {cardUpliftOnPayment > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Amount</span>
                      <span className="tabular-nums font-medium" data-testid="text-card-base">${parsedPaymentAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Card Surcharge ({cardUpliftPercent}%)</span>
                      <span className="tabular-nums font-medium" data-testid="text-card-uplift">+${cardUpliftOnPayment.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Total Charged</span>
                      <span className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400" data-testid="text-card-due">${cardTotalOnPayment.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Card Amount Due</p>
                    <p className="text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-400" data-testid="text-card-due">${parsedPaymentAmount.toFixed(2)}</p>
                  </div>
                )}
              </div>
              {dualPricingEnabled && cardUpliftOnPayment > 0 && (
                <p className="text-xs text-muted-foreground text-center">Cash price: ${parsedPaymentAmount.toFixed(2)} + {cardUpliftPercent}% surcharge: ${cardUpliftOnPayment.toFixed(2)}</p>
              )}

              {settings?.spinEnabled && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Payment Terminal</Label>
                  {terminalStatus?.hasTerminal ? (
                    <>
                      {(terminalStatus.terminals?.length ?? 0) > 1 ? (
                        <Select
                          value={selectedTerminalId ? String(selectedTerminalId) : ""}
                          onValueChange={(v) => setSelectedTerminalId(parseInt(v))}
                        >
                          <SelectTrigger className="h-10" data-testid="select-terminal">
                            <SelectValue placeholder="Select terminal..." />
                          </SelectTrigger>
                          <SelectContent>
                            {terminalStatus.terminals.map((t: any) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                <div className="flex items-center gap-2">
                                  <Wifi className="w-3.5 h-3.5 text-green-600" />
                                  <span>{t.name}</span>
                                  {t.isDefault && <Badge variant="outline" className="text-[10px] ml-1 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">Default</Badge>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20" data-testid="text-terminal-info">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                            <Wifi className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{terminalStatus.terminalName}</p>
                            <p className="text-[11px] text-muted-foreground">{terminalStatus.terminalType?.toUpperCase()} Terminal</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">Ready</Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                      <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-sm text-amber-700 dark:text-amber-400">No payment terminal available</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={paymentMutation.isPending || (settings?.spinEnabled && !terminalStatus?.hasTerminal)}
                onClick={() => paymentMutation.mutate()}
                data-testid="button-confirm-card"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {settings?.spinEnabled && terminalStatus?.hasTerminal ? "Send to Terminal" : "Process Card Payment"}
              </Button>
            </div>
          )}

          {/* Processing State */}
          {paymentMutation.isPending && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-base font-semibold">
                {paymentMethod === "card" && settings?.spinEnabled ? "Waiting for terminal..." : "Processing..."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentMethod === "card" && settings?.spinEnabled
                  ? "Customer should tap, insert, or swipe their card"
                  : "Completing transaction..."
                }
              </p>
            </div>
          )}

          {/* Payment Error State */}
          {paymentError && !paymentMutation.isPending && (() => {
            const t = paymentError.type || "declined";
            const isAmber = t === "cancelled" || t === "timeout" || t === "terminal_busy";
            const borderColor = isAmber ? "border-amber-200 dark:border-amber-800" : "border-red-200 dark:border-red-800";
            const bgColor = isAmber ? "bg-amber-50 dark:bg-amber-950/30" : "bg-red-50 dark:bg-red-950/30";
            const iconBg = isAmber ? "bg-amber-100 dark:bg-amber-900/40" : "bg-red-100 dark:bg-red-900/40";
            const iconColor = isAmber ? "text-amber-600" : "text-red-600";
            const textColor = isAmber ? "text-amber-800 dark:text-amber-300" : "text-red-800 dark:text-red-300";
            const detailColor = isAmber ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
            let subtitle = "";
            if (t === "cancelled") subtitle = "The transaction was cancelled at the terminal";
            else if (t === "timeout") subtitle = "The terminal did not respond in time";
            else if (t === "terminal_error") subtitle = "Check that the terminal is powered on and connected";
            else if (t === "comm_error") subtitle = "Could not communicate with the payment terminal";
            else if (t === "terminal_busy") subtitle = "Another transaction may be in progress";
            else if (t === "declined") subtitle = "The card was not accepted";

            const icon = t === "cancelled" ? <X className={`w-6 h-6 ${iconColor}`} />
              : t === "timeout" ? <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
              : t === "terminal_busy" ? <Loader2 className={`w-6 h-6 ${iconColor}`} />
              : (t === "terminal_error" || t === "comm_error") ? <WifiOff className={`w-6 h-6 ${iconColor}`} />
              : <CreditCard className={`w-6 h-6 ${iconColor}`} />;

            return (
              <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-4 text-center`} data-testid="payment-error">
                <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-3`}>
                  {icon}
                </div>
                <p className={`text-base font-semibold ${textColor}`}>{paymentError.message}</p>
                {subtitle && <p className={`text-xs ${detailColor} mt-1`}>{subtitle}</p>}
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setPaymentError(null); setPaymentMethod(null); }} data-testid="button-error-change-method">
                    Change Method
                  </Button>
                  <Button size="sm" onClick={() => { setPaymentError(null); paymentMutation.mutate(); }} data-testid="button-error-retry">
                    Try Again
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Pickup Confirmation Dialog */}
      <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Confirm Pickup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {balanceDue > 0 ? (
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">${balanceDue.toFixed(2)}</p>
                <p className="text-xs text-red-600 mt-1">Payment must be collected before pickup</p>
              </div>
            ) : (
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">${balanceDue.toFixed(2)} — Paid in Full</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Mark this device as picked up by the customer? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupOpen(false)} data-testid="button-cancel-pickup">Cancel</Button>
            {balanceDue > 0 ? (
              <Button onClick={() => { setPickupOpen(false); openPaymentDialog("final_payment"); }} data-testid="button-collect-payment-first">
                <DollarSign className="w-4 h-4 mr-1" /> Collect Payment
              </Button>
            ) : (
              <Button onClick={() => pickupMutation.mutate()} disabled={pickupMutation.isPending} data-testid="button-confirm-pickup">
                {pickupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Confirm Pickup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resendOpen} onOpenChange={(open) => { setResendOpen(open); if (!open) { setResendReason(""); setResendEmailType(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Resend Notification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will resend the selected notification to the customer on file. A 5-minute cooldown applies between sends of the same type.
            </p>
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {resendEmailType === "ticket_created" ? "Ticket Created" : resendEmailType === "ticket_status_update" ? "Status Update" : resendEmailType === "ready_for_pickup" ? "Ready for Pickup" : resendEmailType}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Ticket</span>
                <span>{ticket?.ticketNumber}</span>
              </div>
              {ticket?.customer?.email && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Recipient</span>
                  <span>{ticket.customer.email}</span>
                </div>
              )}
            </div>
            <div>
              <Label>Reason for resending *</Label>
              <Textarea
                value={resendReason}
                onChange={(e) => setResendReason(e.target.value)}
                placeholder="e.g. Customer did not receive the original notification..."
                data-testid="input-resend-notification-reason"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 10 characters. This is logged for audit purposes.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResendOpen(false); setResendReason(""); setResendEmailType(""); }}>Cancel</Button>
            <Button
              onClick={() => resendNotificationMutation.mutate({ emailType: resendEmailType, reason: resendReason })}
              disabled={resendReason.trim().length < 10 || resendNotificationMutation.isPending}
              data-testid="button-confirm-resend-notification"
            >
              {resendNotificationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Discount Dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {ticketDiscountAmount > 0 ? "Edit Discount" : "Apply Discount"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Discount Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                <SelectTrigger data-testid="select-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {discountType === "percent" ? "Percent Off" : "Dollar Amount"}
              </Label>
              <div className="relative">
                {discountType === "fixed" && <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={discountType === "percent" ? "100" : undefined}
                  placeholder={discountType === "percent" ? "e.g. 10" : "0.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className={discountType === "fixed" ? "pl-8" : ""}
                  data-testid="input-discount-value"
                />
                {discountType === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                )}
              </div>
              {discountValue && parseFloat(discountValue) > 0 && rawSubtotal > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saves customer ${(discountType === "percent"
                    ? Math.round(rawSubtotal * (parseFloat(discountValue) / 100) * 100) / 100
                    : Math.min(parseFloat(discountValue), rawSubtotal)
                  ).toFixed(2)} off ${rawSubtotal.toFixed(2)} subtotal
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Textarea
                placeholder="e.g. Returning customer, loyalty discount, price match..."
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="h-20"
                data-testid="input-discount-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button>
            <Button
              disabled={!discountValue || parseFloat(discountValue) <= 0 || !discountReason.trim() || applyDiscountMutation.isPending}
              onClick={() => applyDiscountMutation.mutate()}
              data-testid="button-confirm-discount"
            >
              {applyDiscountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {ticketDiscountAmount > 0 ? "Update Discount" : "Apply Discount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Email Dialog for Ticket Receipts */}
      <Dialog open={manualEmailOpen} onOpenChange={setManualEmailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Receipt by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the email address to send this receipt to.</p>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              data-testid="input-manual-email"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualEmailOpen(false)}>Cancel</Button>
            <Button
              disabled={!manualEmail.trim() || !manualEmail.includes("@") || resendReceiptMutation.isPending}
              onClick={() => {
                if (manualEmailSaleId && manualEmail.trim()) {
                  resendReceiptMutation.mutate({ saleId: manualEmailSaleId, email: manualEmail.trim() });
                }
              }}
              data-testid="button-send-manual-email"
            >
              {resendReceiptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}