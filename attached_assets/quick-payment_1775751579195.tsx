import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { TaxControl } from "@/components/tax-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardEntryForm, CardEntryValues, emptyCardEntryValues } from "@/components/card-entry-form";
import { AchEntryForm, AchEntryValues, emptyAchEntryValues } from "@/components/ach-entry-form";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard, UserPlus, CheckCircle, Wallet, Check, ChevronsUpDown, Pencil, X, Paperclip, Upload, Download, Trash2, File as FileIcon, Image as ImageIcon, Building2, Monitor, XCircle, MapPin, Lock, ShieldCheck } from "lucide-react";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { calculateTenderAdjustment, extractAdjustmentSettings } from "@shared/pricing-engine";
import type { Customer, InvoiceAttachment } from "@shared/schema";

interface VaultedCard {
  id: string;
  last4: string;
  cardType: string;
  expiryMonth?: string;
  expiryYear?: string;
  name?: string;
}

interface VaultedBank {
  id: string;
  bankName: string | null;
  accountType: string | null;
  last4: string | null;
  accountHolderName: string | null;
  routingNumber: string | null;
  isDefault: boolean;
  isActive: boolean;
}

const paymentSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  tenderType: z.enum(["card", "cash", "check", "ach", "terminal"]),
  customerId: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpMonth: z.string().optional(),
  cardExpYear: z.string().optional(),
  cardCvv: z.string().optional(),
  cardholderName: z.string().optional(),
  billingStreet: z.string().optional(),
  billingZip: z.string().optional(),
  notes: z.string().optional()
});

type PaymentForm = z.infer<typeof paymentSchema>;


export default function QuickPaymentPage() {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [lastPayment, setLastPayment] = useState<{ amount: string; reference?: string } | null>(null);
  const [vaultedCards, setVaultedCards] = useState<VaultedCard[]>([]);
  const [vaultedBanks, setVaultedBanks] = useState<VaultedBank[]>([]);
  const [cardSource, setCardSource] = useState<"new" | "saved">("new");
  const [bankSource, setBankSource] = useState<"new" | "saved">("new");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [includeTax, setIncludeTax] = useState(true);
  const [isEditingTaxRate, setIsEditingTaxRate] = useState(false);
  const [customTaxRate, setCustomTaxRate] = useState<string>("");
  const [isZipTaxMode, setIsZipTaxMode] = useState(false);
  const [taxZipCode, setTaxZipCode] = useState("");
  const [zipTaxRegion, setZipTaxRegion] = useState("");
  const [zipTaxLoading, setZipTaxLoading] = useState(false);
  const [zipTaxError, setZipTaxError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<{id: string; fileName: string; fileSize: number; contentType: string; objectPath: string}[]>([]);
  const [cardEntry, setCardEntry] = useState<CardEntryValues>({ ...emptyCardEntryValues });
  const [achEntry, setAchEntry] = useState<AchEntryValues>({ ...emptyAchEntryValues });
  const [checkNumber, setCheckNumber] = useState("");
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [terminalTxStatus, setTerminalTxStatus] = useState<"idle" | "sending" | "waiting" | "polling" | "completed" | "approved" | "failed" | "cancelled">("idle");
  const [terminalAuditId, setTerminalAuditId] = useState<string | null>(null);
  const [terminalTxAmount, setTerminalTxAmount] = useState<number | null>(null);
  const [terminalTxResult, setTerminalTxResult] = useState<any>(null);
  const [terminalTxError, setTerminalTxError] = useState<string | null>(null);
  const [terminalTxType, setTerminalTxType] = useState<string>("Sale");

  const defaultTaxRateDecimal = tenant?.salesTaxRate ? parseFloat(tenant.salesTaxRate) : 0;
  const parsedCustomRate = customTaxRate !== "" ? parseFloat(customTaxRate) : NaN;
  const taxRateDecimal = !isNaN(parsedCustomRate) && parsedCustomRate >= 0 && parsedCustomRate <= 100
    ? parsedCustomRate / 100 
    : defaultTaxRateDecimal;
  const taxRatePercent = taxRateDecimal * 100;

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"]
  });

  const { data: tenderSettings } = useQuery<any>({
    queryKey: ["/api/settings/tenders"],
  });

  const { data: terminals } = useQuery<any[]>({
    queryKey: ["/api/terminals"],
  });

  useEffect(() => {
    if (terminals && terminals.length > 0 && !selectedTerminalId) {
      const defaultTerminal = terminals.find((t: any) => t.isDefault);
      if (defaultTerminal) {
        setSelectedTerminalId(defaultTerminal.id);
      }
    }
  }, [terminals]);

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      tenderType: "card",
      customerId: "",
      cardNumber: "",
      cardExpMonth: "",
      cardExpYear: "",
      cardCvv: "",
      cardholderName: "",
      billingStreet: "",
      billingZip: "",
      notes: ""
    }
  });

  const watchedAmount = parseFloat(form.watch("amount")) || 0;
  const currentTaxAmount = includeTax && taxRateDecimal > 0 ? watchedAmount * taxRateDecimal : 0;
  const watchedTenderType = form.watch("tenderType");
  const adjustmentSettings = extractAdjustmentSettings(tenant);
  const pricingResult = calculateTenderAdjustment({
    baseAmount: watchedAmount,
    tax: currentTaxAmount,
    tenderType: watchedTenderType,
    adjustmentSettings,
  });
  const currentTotalAmount = pricingResult.total;

  const selectedCustomerId = form.watch("customerId");
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  useEffect(() => {
    if (tenderSettings) {
      const methodMap: Record<string, boolean> = {
        card: tenderSettings.cardQuickPayment,
        ach: tenderSettings.achQuickPayment,
        cash: tenderSettings.cashQuickPayment,
        check: tenderSettings.checkQuickPayment,
        terminal: (tenderSettings.terminalQuickPayment !== false) && (terminals?.length || 0) > 0,
      };
      const currentTender = form.getValues("tenderType");
      if (methodMap[currentTender] === false) {
        const firstEnabled = Object.entries(methodMap).find(([_, v]) => v !== false)?.[0];
        if (firstEnabled) form.setValue("tenderType", firstEnabled as any);
      }
    }
  }, [tenderSettings, terminals]);

  useEffect(() => {
    const fetchVaultedCards = async () => {
      if (!selectedCustomerId) {
        setVaultedCards([]);
        setCardSource("new");
        setSelectedCardId("");
        return;
      }

      setLoadingCards(true);
      try {
        const res = await fetch(`/api/customers/${selectedCustomerId}/vaulted-cards`, {
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          setVaultedCards(data.cards || []);
          if (data.cards?.length > 0) {
            setCardSource("saved");
            setSelectedCardId(String(data.cards[0].id));
          } else {
            setCardSource("new");
            setSelectedCardId("");
          }
        }
      } catch (err) {
        console.error("Failed to fetch vaulted cards:", err);
      } finally {
        setLoadingCards(false);
      }
    };

    const fetchVaultedBanks = async () => {
      if (!selectedCustomerId) {
        setVaultedBanks([]);
        setBankSource("new");
        setSelectedBankId("");
        return;
      }

      setLoadingBanks(true);
      try {
        const res = await fetch(`/api/customers/${selectedCustomerId}/vaulted-banks`, {
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          setVaultedBanks(data.banks || []);
          if (data.banks?.length > 0) {
            setBankSource("saved");
            setSelectedBankId(String(data.banks[0].id));
          } else {
            setBankSource("new");
            setSelectedBankId("");
          }
        }
      } catch (err) {
        console.error("Failed to fetch vaulted banks:", err);
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchVaultedCards();
    fetchVaultedBanks();
  }, [selectedCustomerId]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const uploadAttachment = async (file: globalThis.File) => {
    setIsUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type
      });
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });
      setStagedAttachments(prev => [...prev, {
        id: generateId(),
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        objectPath
      }]);
      toast({ title: "File attached successfully" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      if (data.tenderType === "terminal") {
        throw new Error("Terminal transactions use a separate flow. Please use the 'Send to Terminal' button.");
      }

      const tenderTypeMap: Record<string, string> = {
        card: "Card",
        cash: "Cash",
        check: "Check",
        ach: "ACH"
      };

      const isUsingSavedCard = cardSource === "saved" && selectedCardId;
      
      const baseAmount = parseFloat(data.amount) || 0;
      const taxAmount = includeTax && taxRateDecimal > 0 ? baseAmount * taxRateDecimal : 0;
      const pr = calculateTenderAdjustment({
        baseAmount,
        tax: taxAmount,
        tenderType: data.tenderType,
        adjustmentSettings,
      });
      const totalAmount = pr.total;
      
      const payload: Record<string, any> = {
        amount: totalAmount,
        tenderType: tenderTypeMap[data.tenderType] || "Card",
        customerId: data.customerId || null,
        adjustmentAmount: pr.adjustmentAmount > 0 ? pr.adjustmentAmount : undefined,
        adjustmentType: pr.adjustmentType || undefined,
        adjustmentLabel: pr.adjustmentLabel || undefined,
      };

      if (data.tenderType === "check") {
        payload.checkNumber = checkNumber || null;
      }

      if (data.tenderType === "ach") {
        const isUsingSavedBank = bankSource === "saved" && selectedBankId;
        if (isUsingSavedBank) {
          payload.savedBankAccountId = selectedBankId;
          payload.mxCustomerId = selectedCustomer?.mxCustomerId;
        } else {
          payload.bankAccountNumber = achEntry.accountNumber;
          payload.bankRoutingNumber = achEntry.routingNumber;
          payload.bankAccountType = achEntry.accountType;
          payload.bankAccountHolderName = achEntry.accountHolderName;
          payload.achEntryClass = "WEB";
        }
      }

      if (data.tenderType === "card") {
        if (isUsingSavedCard) {
          payload.cardAccountId = selectedCardId;
          payload.mxCustomerId = selectedCustomer?.mxCustomerId;
        } else {
          payload.cardNumber = cardEntry.cardNumber;
          payload.expiryMonth = cardEntry.expiryMonth;
          payload.expiryYear = cardEntry.expiryYear;
          payload.cvv = cardEntry.cvv;
          payload.customerName = cardEntry.cardholderName;
          payload.avsStreet = cardEntry.avsStreet;
          payload.avsZip = cardEntry.avsZip;
        }
      }

      const res = await apiRequest("POST", "/api/mx/payments", payload);
      const response = await res.json() as { success: boolean; message?: string; payment?: any; mxResult?: any };
      if (response && response.success === false) {
        throw new Error(response.message || "Payment processing failed");
      }
      return response;
    },
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      const mxResult = response.mxResult;
      const mxStatus = (mxResult?.status || "").toLowerCase();
      const paymentStatus = (response.payment?.status || "").toLowerCase();
      const isDeclined = mxStatus.includes("declined") || paymentStatus.includes("declined");
      
      const totalPaid = currentTotalAmount.toFixed(2);

      if (!isDeclined && response.payment?.id && stagedAttachments.length > 0) {
        const failures: string[] = [];
        for (const att of stagedAttachments) {
          try {
            await apiRequest("POST", `/api/payments/${response.payment.id}/attachments`, {
              fileName: att.fileName,
              fileSize: att.fileSize,
              contentType: att.contentType,
              objectPath: att.objectPath
            });
          } catch (e) {
            console.error("Failed to save attachment:", att.fileName, e);
            failures.push(att.fileName);
          }
        }
        setStagedAttachments([]);
        if (failures.length > 0) {
          toast({
            title: "Some attachments failed to save",
            description: `Failed: ${failures.join(", ")}`,
            variant: "destructive"
          });
        }
      }
      
      setIsAddingCustomer(false);
      form.reset();
      setCardEntry({ ...emptyCardEntryValues });
      setCheckNumber("");
      
      setTimeout(() => {
        if (isDeclined) {
          const declineReason = mxResult?.authMessage || mxResult?.message || "Transaction declined by processor";
          toast({
            title: "Payment Declined",
            description: declineReason,
            variant: "destructive"
          });
        } else {
          setLastPayment({
            amount: totalPaid,
            reference: response.payment?.referenceNumber
          });
          toast({
            title: "Payment Approved",
            description: `Payment of $${response.payment?.amount || totalPaid} processed successfully.`
          });
          setTimeout(() => {
            apiRequest("POST", "/api/mx/sync/transactions")
              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/payments"] }))
              .catch(() => {});
          }, 500);
        }
      }, 100);
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to process payment.";
      toast({
        title: "Payment failed",
        description: message.includes("No active MX credentials") 
          ? "Please configure MX Merchant API credentials in Settings before processing payments."
          : message,
        variant: "destructive"
      });
    }
  });

  const resetTerminalState = () => {
    setTerminalTxStatus("idle");
    setTerminalAuditId(null);
    setTerminalTxAmount(null);
    setTerminalTxResult(null);
    setTerminalTxError(null);
  };

  const pollTerminalTransaction = async (auditId: string, txAmount: number, termId: string) => {
    setTerminalTxStatus("polling");
    let attempts = 0;
    const maxAttempts = 60;
    const pollInterval = 4000;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setTerminalTxStatus("failed");
        setTerminalTxError("Transaction timed out waiting for terminal response. The customer may not have completed the transaction on the device.");
        return;
      }
      attempts++;
      try {
        const params = new URLSearchParams({ terminalId: termId });
        if (auditId) params.set("devicePaymentAuditId", auditId);
        if (txAmount) params.set("amount", String(txAmount));
        const res = await fetch(`/api/terminal-transactions/poll?${params.toString()}`, { credentials: "include" });
        if (!res.ok) {
          setTimeout(poll, pollInterval);
          return;
        }
        const data = await res.json();
        console.log("[Terminal Poll] Response:", JSON.stringify(data));
        const status = (data.status || "").toString().toLowerCase();
        
        if (status === "pending") {
          setTimeout(poll, pollInterval);
          return;
        }
        
        const isApproved = status === "approved" || status === "captured" || status === "settled" || status === "success"
          || (data.authCode && !["declined", "error", "voided", "failed"].includes(status));
        const isDeclined = status === "declined" || status === "error" || status === "voided" || status === "failed";
        
        if (isApproved) {
          setTerminalTxResult(data);
          setTerminalTxStatus("completed");
          const resultAmount = data.amount || data.totalAmount || form.getValues("amount");
          setLastPayment({
            amount: String(resultAmount),
            reference: data.id?.toString() || data.referenceNumber || data.transactionId
          });
          toast({
            title: "Terminal Payment Approved",
            description: `Payment of $${parseFloat(String(resultAmount) || "0").toFixed(2)} processed successfully via terminal.`
          });
          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          setTimeout(() => {
            apiRequest("POST", "/api/mx/sync/transactions")
              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/payments"] }))
              .catch(() => {});
          }, 500);
        } else if (isDeclined) {
          setTerminalTxResult(data);
          setTerminalTxStatus("failed");
          setTerminalTxError(data.authMessage || data.responseMessage || data.message || `Transaction ${status}`);
          toast({
            title: "Terminal Payment Failed",
            description: data.authMessage || data.responseMessage || data.message || `Transaction was ${status}`,
            variant: "destructive"
          });
        } else {
          setTimeout(poll, pollInterval);
        }
      } catch (err) {
        setTimeout(poll, pollInterval);
      }
    };

    setTimeout(poll, 5000);
  };

  const sendToTerminal = async () => {
    const amount = form.getValues("amount");
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Amount required", description: "Please enter an amount before sending to terminal.", variant: "destructive" });
      return;
    }
    if (!selectedTerminalId) {
      toast({ title: "Terminal required", description: "Please select a terminal device.", variant: "destructive" });
      return;
    }

    const baseAmount = parseFloat(amount) || 0;
    const taxAmount = includeTax && taxRateDecimal > 0 ? baseAmount * taxRateDecimal : 0;
    const termPr = calculateTenderAdjustment({
      baseAmount,
      tax: taxAmount,
      tenderType: "card",
      adjustmentSettings,
    });
    const totalAmount = termPr.total;

    setTerminalTxStatus("sending");
    setTerminalTxError(null);
    setTerminalTxResult(null);

    try {
      const res = await apiRequest("POST", "/api/terminal-transactions", {
        terminalId: selectedTerminalId,
        amount: totalAmount,
        type: terminalTxType,
        vaultCard: false,
        customerId: form.getValues("customerId") || null,
      });
      const data = await res.json();

      if (data.completed && data.approved) {
        setTerminalTxStatus("approved");
        setTerminalTxResult(data);
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        toast({ title: "Payment Approved", description: `Transaction approved. Auth: ${data.authCode || "N/A"}` });
        return;
      }

      if (data.completed && !data.approved) {
        setTerminalTxStatus("failed");
        setTerminalTxError(data.message || "Transaction declined");
        toast({ title: "Transaction Declined", description: data.message || "The transaction was declined.", variant: "destructive" });
        return;
      }

      const auditId = data.devicePaymentAuditId || 
        data.result?.prioritypaymentsystems?.mxmerchant?.merchant?.devicePaymentAuditId ||
        data.result?.priorityPaymentSystems?.mxMerchant?.merchant?.devicePaymentAuditId || "";
      if (data.success && auditId) {
        setTerminalAuditId(auditId);
        setTerminalTxAmount(totalAmount);
        setTerminalTxStatus("waiting");
        toast({ title: "Sent to Terminal", description: "Transaction sent to the terminal device. Waiting for customer to complete payment..." });
        pollTerminalTransaction(auditId, totalAmount, selectedTerminalId);
      } else if (data.success) {
        setTerminalTxAmount(totalAmount);
        setTerminalTxStatus("waiting");
        toast({ title: "Sent to Terminal", description: "Transaction sent to the terminal device. Waiting for customer to complete payment..." });
        pollTerminalTransaction("", totalAmount, selectedTerminalId);
      } else {
        setTerminalTxStatus("failed");
        setTerminalTxError(data.message || "Failed to send transaction to terminal");
        toast({ title: "Terminal Error", description: data.message || "Failed to send to terminal", variant: "destructive" });
      }
    } catch (err: any) {
      setTerminalTxStatus("failed");
      setTerminalTxError(err.message || "Failed to send transaction to terminal");
      toast({ title: "Terminal Error", description: err.message || "Failed to send to terminal", variant: "destructive" });
    }
  };

  const cancelTerminalTransaction = async () => {
    if (!selectedTerminalId) return;
    try {
      await apiRequest("DELETE", `/api/terminal-transactions/${selectedTerminalId}`);
      setTerminalTxStatus("cancelled");
      toast({ title: "Transaction Cancelled", description: "Terminal transaction has been cancelled." });
    } catch (err: any) {
      toast({ title: "Cancel Failed", description: err.message || "Failed to cancel terminal transaction", variant: "destructive" });
    }
  };

  const handleNewPayment = () => {
    setLastPayment(null);
    setVaultedCards([]);
    setVaultedBanks([]);
    setCardSource("new");
    setBankSource("new");
    setSelectedCardId("");
    setSelectedBankId("");
    setStagedAttachments([]);
    setCheckNumber("");
    resetTerminalState();
    setSelectedTerminalId("");
    form.reset();
    setCardEntry({ ...emptyCardEntryValues });
    setAchEntry({ ...emptyAchEntryValues });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Quick Payment"
        description="Process a payment quickly and easily"
      />

      <div className="max-w-2xl mx-auto">
        {lastPayment ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                    <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">Payment Successful</h3>
                  <p className="text-muted-foreground mt-1">
                    ${parseFloat(lastPayment.amount).toFixed(2)} has been processed
                  </p>
                  {lastPayment.reference && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Reference: {lastPayment.reference}
                    </p>
                  )}
                </div>
                <Button onClick={handleNewPayment} className="mt-4" data-testid="button-new-payment">
                  Process Another Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createPaymentMutation.mutate(data))} className="space-y-4">
                  {/* ── Charge summary header ── */}
                  <div className="rounded-xl border border-border overflow-hidden transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                    <div className="px-5 py-4 bg-muted/20 border-b transition-colors focus-within:bg-background/80">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Transaction Amount</p>
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-light select-none">$</span>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-9 h-14 text-2xl font-semibold tabular-nums border-0 bg-transparent focus-visible:ring-0 shadow-none"
                                  data-testid="input-amount"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {taxRateDecimal > 0 && (
                      <div className="px-5 py-3 space-y-2 bg-background border-b">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="tabular-nums" data-testid="text-subtotal">${watchedAmount.toFixed(2)}</span>
                        </div>
                        <TaxControl
                          includeTax={includeTax}
                          setIncludeTax={setIncludeTax}
                          isZipTaxMode={isZipTaxMode}
                          setIsZipTaxMode={setIsZipTaxMode}
                          taxZipCode={taxZipCode}
                          setTaxZipCode={setTaxZipCode}
                          customTaxRate={customTaxRate}
                          setCustomTaxRate={setCustomTaxRate}
                          zipTaxRegion={zipTaxRegion}
                          setZipTaxRegion={setZipTaxRegion}
                          zipTaxLoading={zipTaxLoading}
                          setZipTaxLoading={setZipTaxLoading}
                          zipTaxError={zipTaxError}
                          setZipTaxError={setZipTaxError}
                          isEditingTaxRate={isEditingTaxRate}
                          setIsEditingTaxRate={setIsEditingTaxRate}
                          taxRatePercent={taxRatePercent}
                          defaultTaxRatePercent={defaultTaxRateDecimal * 100}
                          taxAmount={currentTaxAmount}
                          formatAmount={(n) => `$${n.toFixed(2)}`}
                          testIdPrefix="tax"
                        />
                      </div>
                    )}

                    {pricingResult.adjustmentAmount > 0 && (
                      <div className="px-5 py-2 bg-background border-b">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground" data-testid="text-adjustment-label">{pricingResult.adjustmentLabel}</span>
                          <span className="tabular-nums text-amber-600 dark:text-amber-400 font-medium" data-testid="text-adjustment-amount">+${pricingResult.adjustmentAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className={`flex items-center justify-between px-5 py-4 transition-colors ${currentTotalAmount > 0 ? "bg-primary/5 dark:bg-primary/10" : "bg-muted/10"}`}>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Charge</p>
                        {taxRateDecimal === 0 && pricingResult.adjustmentAmount === 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">No sales tax</p>
                        )}
                      </div>
                      <p className={`text-3xl font-bold tabular-nums tracking-tight transition-colors ${currentTotalAmount > 0 ? "text-foreground" : "text-muted-foreground/50"}`} data-testid="text-total">
                        ${currentTotalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* ── Section break ── */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payment Details</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <FormField
                    control={form.control}
                    name="tenderType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tender-type">
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(!tenderSettings || tenderSettings.cardQuickPayment) && (
                              <SelectItem value="card">Credit/Debit Card</SelectItem>
                            )}
                            {(!tenderSettings || tenderSettings.achQuickPayment) && (
                              <SelectItem value="ach">ACH / Bank Account</SelectItem>
                            )}
                            {(!tenderSettings || tenderSettings.cashQuickPayment) && (
                              <SelectItem value="cash">Cash</SelectItem>
                            )}
                            {(!tenderSettings || tenderSettings.checkQuickPayment) && (
                              <SelectItem value="check">Check</SelectItem>
                            )}
                            {terminals && terminals.length > 0 && (!tenderSettings || tenderSettings.terminalQuickPayment !== false) && (
                              <SelectItem value="terminal">Terminal Device</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => {
                      const selectedCustomerData = customers?.find(c => c.id === field.value);
                      const filteredCustomers = customers?.filter(customer => {
                        if (!customerSearchQuery) return true;
                        const query = customerSearchQuery.toLowerCase();
                        const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
                        const company = (customer.company || "").toLowerCase();
                        const legalName = (customer.legalCompanyName || "").toLowerCase();
                        const email = (customer.email || "").toLowerCase();
                        const accountNumber = (customer.accountNumber || "").toLowerCase();
                        return fullName.includes(query) || company.includes(query) || legalName.includes(query) || email.includes(query) || accountNumber.includes(query);
                      }) || [];
                      
                      return (
                        <FormItem className="flex flex-col">
                          <div className="flex items-center justify-between mb-1">
                            <FormLabel className="mb-0">Customer</FormLabel>
                            <span className="text-xs text-muted-foreground">Optional — for records &amp; receipts</span>
                          </div>
                          <div className="flex rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="ghost"
                                    role="combobox"
                                    aria-expanded={customerSearchOpen}
                                    className={cn(
                                      "flex-1 justify-between rounded-none border-0 border-r h-10 focus-visible:ring-0",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="select-customer"
                                  >
                                    {selectedCustomerData ? (
                                      <div className="flex flex-col items-start text-left truncate">
                                        <span className="truncate">
                                          {selectedCustomerData.firstName} {selectedCustomerData.lastName}
                                        </span>
                                        {(selectedCustomerData.company || selectedCustomerData.legalCompanyName) && (
                                          <span className="text-xs text-muted-foreground truncate">
                                            {selectedCustomerData.company && `DBA: ${selectedCustomerData.company}`}
                                            {selectedCustomerData.company && selectedCustomerData.legalCompanyName && " • "}
                                            {selectedCustomerData.legalCompanyName && `Legal: ${selectedCustomerData.legalCompanyName}`}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      "Search customers..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full max-w-md p-0" align="start">
                                <Command shouldFilter={false}>
                                  <CommandInput 
                                    placeholder="Search by name, DBA, legal name, or account #..." 
                                    value={customerSearchQuery}
                                    onValueChange={setCustomerSearchQuery}
                                    data-testid="input-customer-search"
                                  />
                                  <CommandList>
                                    <CommandEmpty>No customers found.</CommandEmpty>
                                    <CommandGroup className="max-h-[300px] overflow-auto">
                                      {filteredCustomers.map((customer) => (
                                        <CommandItem
                                          key={customer.id}
                                          value={customer.id}
                                          onSelect={() => {
                                            field.onChange(customer.id);
                                            setCustomerSearchOpen(false);
                                            setCustomerSearchQuery("");
                                          }}
                                          className="cursor-pointer"
                                          data-testid={`customer-option-${customer.id}`}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === customer.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">
                                              {customer.firstName} {customer.lastName}
                                            </span>
                                            {(customer.company || customer.legalCompanyName) && (
                                              <span className="text-sm text-muted-foreground truncate">
                                                {customer.company && <span>DBA: {customer.company}</span>}
                                                {customer.company && customer.legalCompanyName && " • "}
                                                {customer.legalCompanyName && <span>Legal: {customer.legalCompanyName}</span>}
                                              </span>
                                            )}
                                            {customer.email && (
                                              <span className="text-xs text-muted-foreground truncate">{customer.email}</span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsAddingCustomer(true)}
                              className="h-10 w-10 shrink-0 rounded-none"
                              data-testid="button-add-new-customer"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {form.watch("tenderType") === "check" && (
                    <div className="space-y-2">
                      <FormLabel>Check Number</FormLabel>
                      <Input
                        placeholder="Enter check number"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        data-testid="input-check-number"
                      />
                    </div>
                  )}

                  {form.watch("tenderType") === "ach" && (
                    <>
                      {loadingBanks && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading saved bank accounts...
                        </div>
                      )}

                      {!loadingBanks && vaultedBanks.length > 0 && (
                        <div className="space-y-3">
                          <FormLabel>Bank Account Source</FormLabel>
                          <RadioGroup
                            value={bankSource}
                            onValueChange={(value) => {
                              setBankSource(value as "new" | "saved");
                              if (value === "saved" && vaultedBanks.length > 0) {
                                setSelectedBankId(String(vaultedBanks[0].id));
                              }
                            }}
                            className="flex flex-wrap gap-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="saved" id="saved-bank" data-testid="radio-saved-bank" />
                              <Label htmlFor="saved-bank" className="flex items-center gap-1 cursor-pointer">
                                <Wallet className="h-4 w-4" />
                                Saved Bank
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="new" id="new-bank" data-testid="radio-new-bank" />
                              <Label htmlFor="new-bank" className="flex items-center gap-1 cursor-pointer">
                                <Building2 className="h-4 w-4" />
                                New Bank Account
                              </Label>
                            </div>
                          </RadioGroup>

                          {bankSource === "saved" && (
                            <div className="space-y-2">
                              <FormLabel>Select Saved Bank Account</FormLabel>
                              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                <SelectTrigger data-testid="select-saved-bank">
                                  <SelectValue placeholder="Select a saved bank account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {vaultedBanks.map((bank) => (
                                    <SelectItem key={bank.id} value={String(bank.id)}>
                                      {bank.bankName || "Bank"} •••• {bank.last4 || "****"}
                                      {bank.accountType && ` (${bank.accountType})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}

                      {bankSource === "new" && (
                        <AchEntryForm
                          values={achEntry}
                          onChange={setAchEntry}
                          idPrefix="qp"
                        />
                      )}
                    </>
                  )}

                  {form.watch("tenderType") === "terminal" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <FormLabel>Terminal Device *</FormLabel>
                        <Select value={selectedTerminalId} onValueChange={(val) => { setSelectedTerminalId(val); resetTerminalState(); }}>
                          <SelectTrigger data-testid="select-terminal">
                            <SelectValue placeholder="Select a terminal" />
                          </SelectTrigger>
                          <SelectContent>
                            {terminals?.map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <Monitor className="h-4 w-4" />
                                  <span>{t.name || t.terminalName || `Terminal ${t.mxTerminalId}`}</span>
                                  {t.model && <span className="text-muted-foreground text-xs">({t.model})</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Transaction Type</FormLabel>
                        <Select value={terminalTxType} onValueChange={setTerminalTxType}>
                          <SelectTrigger data-testid="select-terminal-tx-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sale">Sale</SelectItem>
                            <SelectItem value="Authorization">Authorization (Pre-Auth)</SelectItem>
                            <SelectItem value="Refund">Refund</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {terminalTxStatus === "idle" && (
                        <Button
                          type="button"
                          className="w-full"
                          onClick={sendToTerminal}
                          disabled={!selectedTerminalId || !form.getValues("amount")}
                          data-testid="button-send-to-terminal"
                        >
                          <Monitor className="h-4 w-4 mr-2" />
                          Send to Terminal
                        </Button>
                      )}

                      {(terminalTxStatus === "sending") && (
                        <div className="flex items-center gap-2 p-4 rounded-md bg-muted/50 text-sm">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span>Processing terminal transaction...</span>
                        </div>
                      )}

                      {terminalTxStatus === "approved" && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-md border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 text-sm">
                            <p className="font-medium text-green-700 dark:text-green-300">Transaction Approved</p>
                            {terminalTxResult && (
                              <div className="text-muted-foreground mt-2 space-y-1">
                                {terminalTxResult.authCode && <p>Auth Code: <span className="font-mono">{terminalTxResult.authCode}</span></p>}
                                {terminalTxResult.cardBrand && terminalTxResult.cardLast4 && (
                                  <p>Card: {terminalTxResult.cardBrand} ****{terminalTxResult.cardLast4}</p>
                                )}
                                {terminalTxResult.amount && <p>Amount: ${parseFloat(terminalTxResult.amount).toFixed(2)}</p>}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={resetTerminalState}
                            data-testid="button-new-terminal-tx"
                          >
                            Start New Transaction
                          </Button>
                        </div>
                      )}

                      {(terminalTxStatus === "waiting" || terminalTxStatus === "polling") && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 text-sm">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                            <div>
                              <p className="font-medium text-blue-700 dark:text-blue-300">Waiting for customer...</p>
                              <p className="text-muted-foreground mt-1">The transaction has been sent to the terminal. Please ask the customer to complete the payment on the device.</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={cancelTerminalTransaction}
                            data-testid="button-cancel-terminal-tx"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel Transaction
                          </Button>
                        </div>
                      )}

                      {terminalTxStatus === "failed" && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
                            <p className="font-medium text-destructive">Transaction Failed</p>
                            {terminalTxError && <p className="text-muted-foreground mt-1">{terminalTxError}</p>}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={resetTerminalState}
                            data-testid="button-retry-terminal"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}

                      {terminalTxStatus === "cancelled" && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-md border bg-muted/50 text-sm">
                            <p className="font-medium">Transaction Cancelled</p>
                            <p className="text-muted-foreground mt-1">The terminal transaction was cancelled.</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={resetTerminalState}
                            data-testid="button-new-terminal-tx"
                          >
                            Start New Transaction
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {form.watch("tenderType") === "card" && (
                    <>
                      {loadingCards && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading saved cards...
                        </div>
                      )}
                      
                      {!loadingCards && vaultedCards.length > 0 && (
                        <div className="space-y-3">
                          <FormLabel>Card Source</FormLabel>
                          <RadioGroup
                            value={cardSource}
                            onValueChange={(value) => {
                              setCardSource(value as "new" | "saved");
                              if (value === "saved" && vaultedCards.length > 0) {
                                setSelectedCardId(String(vaultedCards[0].id));
                              }
                            }}
                            className="flex flex-wrap gap-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="saved" id="saved-card" data-testid="radio-saved-card" />
                              <Label htmlFor="saved-card" className="flex items-center gap-1 cursor-pointer">
                                <Wallet className="h-4 w-4" />
                                Saved Card
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="new" id="new-card" data-testid="radio-new-card" />
                              <Label htmlFor="new-card" className="flex items-center gap-1 cursor-pointer">
                                <CreditCard className="h-4 w-4" />
                                New Card
                              </Label>
                            </div>
                          </RadioGroup>

                          {cardSource === "saved" && (
                            <div className="space-y-2">
                              <FormLabel>Select Saved Card</FormLabel>
                              <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                <SelectTrigger data-testid="select-saved-card">
                                  <SelectValue placeholder="Select a saved card" />
                                </SelectTrigger>
                                <SelectContent>
                                  {vaultedCards.map((card) => (
                                    <SelectItem key={card.id} value={String(card.id)}>
                                      {card.cardType} ending in {card.last4}
                                      {card.expiryMonth && card.expiryYear && ` (${card.expiryMonth}/${card.expiryYear})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}

                      {cardSource === "new" && (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              Card Details
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                              Encrypted &amp; secure
                            </div>
                          </div>
                          <div className="p-4">
                            <CardEntryForm
                              values={cardEntry}
                              onChange={setCardEntry}
                              idPrefix="qp"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {form.watch("tenderType") !== "terminal" && (
                    <div className="space-y-2 pt-1">
                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold"
                        disabled={createPaymentMutation.isPending}
                        data-testid="button-submit-payment"
                      >
                        {createPaymentMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            {currentTotalAmount > 0
                              ? `Process Payment · $${currentTotalAmount.toFixed(2)}`
                              : "Process Payment"}
                          </>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        Payment is charged immediately. You can void or refund from the Payments page if needed.
                      </p>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-dashed border-border bg-muted/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-border/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="font-medium">Attachments</span>
                <span className="text-xs text-muted-foreground/70">(optional)</span>
              </div>
              <label htmlFor="payment-attachment-upload">
                <input
                  id="payment-attachment-upload"
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      Array.from(files).forEach(f => uploadAttachment(f));
                    }
                    e.target.value = "";
                  }}
                  data-testid="input-attachment-upload"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={isUploading}
                  onClick={() => document.getElementById("payment-attachment-upload")?.click()}
                  data-testid="button-upload-attachment"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {isUploading ? "Uploading..." : "Add file"}
                </Button>
              </label>
            </div>
            <div className="px-4 py-3">
              {stagedAttachments.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">Attach receipts, contracts, or supporting docs for this transaction.</p>
              ) : (
                <div className="space-y-1.5">
                  {stagedAttachments.map((att) => {
                    const isImage = (att.contentType || "").startsWith("image/");
                    const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : null;
                    return (
                      <div
                        key={att.id}
                        className="flex items-center gap-2.5 p-2 rounded-md bg-background border text-sm"
                        data-testid={`attachment-item-${att.id}`}
                      >
                        {isImage ? (
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{att.fileName}</p>
                          {sizeKB && (
                            <p className="text-xs text-muted-foreground">{sizeKB} KB</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setStagedAttachments(prev => prev.filter(a => a.id !== att.id))}
                          data-testid={`button-delete-attachment-${att.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      <NewCustomerDialog
        open={isAddingCustomer}
        onOpenChange={setIsAddingCustomer}
        onCustomerCreated={(customer) => {
          form.setValue("customerId", customer.id);
        }}
      />
    </div>
  );
}
