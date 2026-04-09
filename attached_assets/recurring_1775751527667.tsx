import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { calculateTenderAdjustment, extractAdjustmentSettings } from "@shared/pricing-engine";
import { Button } from "@/components/ui/button";
import { TaxControl } from "@/components/tax-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardEntryForm, CardEntryValues, emptyCardEntryValues } from "@/components/card-entry-form";
import { AchEntryForm, AchEntryValues, emptyAchEntryValues } from "@/components/ach-entry-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, MoreHorizontal, Pause, Play, X, RefreshCw, Pencil, Trash2, CreditCard, Loader2, Check, ChevronsUpDown, Wallet, Paperclip, Upload, File as FileIcon, Image as ImageIcon, Building2, UserPlus, DollarSign, CalendarCheck, CalendarClock, FileSignature, MapPin, Eye, AlertTriangle, Mail, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

function formatDateUTC(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
import { cn } from "@/lib/utils";
import type { RecurringPlan } from "@shared/schema";

type ContractLineItem = {
  name: string;
  description: string;
  price: string;
};

type Contract = {
  id: string;
  tenantId: string;
  customerId: string | null;
  vaultedCardId: string | null;
  mxCardAccountId: string | null;
  name: string;
  amount: string;
  lineItems: ContractLineItem[] | null;
  frequency: string;
  numberOfOccurrences: number | null;
  startDate: string;
  endDate: string | null;
  nextPaymentDate: string | null;
  status: "active" | "paused" | "cancelled" | "completed" | "failed";
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  paymentMethodType: string | null;
  vaultedBankId: string | null;
  agreementId: string | null;
  createdAt: string;
  terminalFailureAt: string | null;
  terminalFailureAmount: string | null;
  terminalFailureAgentName: string | null;
  terminalFailureAgentId: string | null;
  recoveryInvoiceId: string | null;
  recoveryBillingPeriodKey: string | null;
  customerRecoveryTriggered: boolean;
  customerRecoveryEmailSentAt: string | null;
  customerRecoveryEmailLastError: string | null;
  agentLiabilityTriggered: boolean;
  agentLiabilityInvoiceId: string | null;
  agentLiabilityNotifiedAt: string | null;
  agentLiabilityChargeAttemptedAt: string | null;
  agentLiabilityChargeResult: string | null;
  agentCoveredBilling: boolean;
  agentCoveredAgentId: string | null;
  agentCoveredSince: string | null;
};

type OperationalState =
  | "agent_liability"
  | "agent_covered"
  | "customer_recovery"
  | "terminal_failure"
  | "retrying"
  | "healthy_active"
  | "paused"
  | "completed"
  | "cancelled";

function getOperationalState(c: Contract): OperationalState {
  if (c.agentCoveredBilling && c.status === "active") return "agent_covered";
  if (c.status === "failed") {
    if (c.agentLiabilityTriggered) {
      return c.agentLiabilityChargeResult === "success" ? "terminal_failure" : "agent_liability";
    }
    if (c.customerRecoveryTriggered) return "customer_recovery";
    return "terminal_failure";
  }
  if (c.status === "active" && c.consecutiveFailures > 0) return "retrying";
  if (c.status === "paused") return "paused";
  if (c.status === "completed") return "completed";
  if (c.status === "cancelled") return "cancelled";
  return "healthy_active";
}

const opStatePriority: Record<OperationalState, number> = {
  agent_liability: 0,
  agent_covered: 1,
  customer_recovery: 2,
  terminal_failure: 3,
  retrying: 4,
  healthy_active: 5,
  paused: 6,
  completed: 7,
  cancelled: 8,
};

const opStateLabels: Record<OperationalState, string> = {
  agent_liability: "Agent Liability",
  agent_covered: "Agent Covered",
  customer_recovery: "Recovery Pending",
  terminal_failure: "Failed",
  retrying: "Retrying",
  healthy_active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

type BillingRun = {
  id: string;
  contractId: string;
  paymentId: string | null;
  amount: string;
  status: "success" | "failed" | "skipped";
  errorMessage: string | null;
  mxPaymentId: string | null;
  scheduledDate: string;
  processedAt: string;
  createdAt: string;
};

type VaultedCard = {
  id: string | number;
  cardBrand?: string | null;
  cardType?: string | null;
  last4?: string | null;
  lastFour?: string | null;
  expiryMonth?: string | null;
  expiryYear?: string | null;
  cardholderName?: string | null;
  number?: string | null;
  name?: string | null;
  isDefault?: boolean;
};

type VaultedBank = {
  id: string;
  bankName: string | null;
  accountType: string | null;
  last4: string | null;
  accountHolderName: string | null;
  routingNumber: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Customer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  legalCompanyName: string | null;
  email: string | null;
  mxCustomerId: string | null;
  accountNumber: string | null;
  salesOfficeAgent: string | null;
};

type LineItem = {
  id: string;
  name: string;
  description: string;
  price: string;
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
  failed: "Failed",
};

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export default function RecurringPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { tenant } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [billingHistoryContract, setBillingHistoryContract] = useState<Contract | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [attachmentsContract, setAttachmentsContract] = useState<Contract | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    customerId: "",
    mxCardAccountId: "",
    frequency: "monthly",
    numberOfOccurrences: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    processFirstPayment: false,
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "item-initial", name: "", description: "", price: "" }
  ]);
  const [customerCards, setCustomerCards] = useState<VaultedCard[]>([]);
  const [customerBanks, setCustomerBanks] = useState<VaultedBank[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  
  const [paymentMethodType, setPaymentMethodType] = useState<"vaulted" | "new_card" | "ach" | "saved_bank">("vaulted");
  
  const [newCardData, setNewCardData] = useState<CardEntryValues>({ ...emptyCardEntryValues });
  const [achData, setAchData] = useState<AchEntryValues>({ ...emptyAchEntryValues });
  const [vaultingCard, setVaultingCard] = useState(false);
  
  // Tax editing state
  const [includeTax, setIncludeTax] = useState(true);
  const [isEditingTaxRate, setIsEditingTaxRate] = useState(false);
  const [customTaxRate, setCustomTaxRate] = useState<string>("");
  const [isZipTaxMode, setIsZipTaxMode] = useState(false);
  const [taxZipCode, setTaxZipCode] = useState("");
  const [zipTaxRegion, setZipTaxRegion] = useState("");
  const [zipTaxLoading, setZipTaxLoading] = useState(false);
  const [zipTaxError, setZipTaxError] = useState("");

  // Attachment state
  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<{id: string; fileName: string; fileSize: number; contentType: string; objectPath: string}[]>([]);
  
  // Line items calculations
  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  
  // Tax calculations
  const defaultSalesTaxRate = parseFloat(tenant?.salesTaxRate || "0.0825");
  const parsedCustomRate = customTaxRate !== "" ? parseFloat(customTaxRate) : NaN;
  const salesTaxRate = !isNaN(parsedCustomRate) && parsedCustomRate >= 0 && parsedCustomRate <= 100
    ? parsedCustomRate / 100 
    : defaultSalesTaxRate;
  const taxAmount = includeTax ? subtotal * salesTaxRate : 0;
  const recurAdjSettings = extractAdjustmentSettings(tenant);
  const recurTenderType = (paymentMethodType === "ach" || paymentMethodType === "saved_bank") ? "ach" : "card";
  const recurPricingResult = calculateTenderAdjustment({
    baseAmount: subtotal,
    tax: taxAmount,
    tenderType: recurTenderType,
    adjustmentSettings: recurAdjSettings,
  });
  const totalAmount = recurPricingResult.total;

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"]
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"]
  });

  const { data: recurringPlans = [] } = useQuery<RecurringPlan[]>({
    queryKey: ["/api/recurring-plans"]
  });

  const { data: tenderSettings } = useQuery<any>({
    queryKey: ["/api/settings/tenders"],
  });

  const { data: billingSummary, isLoading: isSummaryLoading } = useQuery<{
    billedThisMonth: number;
    toBeBilledThisMonth: number;
    nextMonthTotal: number;
  }>({
    queryKey: ["/api/contracts/billing-summary"],
  });

  type AttachmentRecord = {
    id: string;
    fileName: string;
    fileSize: number | null;
    contentType: string | null;
    objectPath: string;
    createdAt: string;
  };

  const { data: contractAttachments = [], isLoading: attachmentsLoading, isError: attachmentsError } = useQuery<AttachmentRecord[]>({
    queryKey: ["/api/contracts", attachmentsContract?.id, "attachments"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${attachmentsContract!.id}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!attachmentsContract,
  });

  const { data: billingRuns, isLoading: billingRunsLoading } = useQuery<BillingRun[]>({
    queryKey: ["/api/contracts", billingHistoryContract?.id, "billing-runs"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${billingHistoryContract!.id}/billing-runs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch billing runs");
      return res.json();
    },
    enabled: !!billingHistoryContract
  });

  const runBillingMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/run-billing`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (billingHistoryContract) {
        queryClient.invalidateQueries({ queryKey: ["/api/contracts", billingHistoryContract.id, "billing-runs"] });
      }
      toast({
        title: data.success ? "Payment Processed" : "Payment Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run billing",
        variant: "destructive"
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contracts", data);
      return res.json();
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });

      if (data.id && stagedAttachments.length > 0) {
        try {
          for (const att of stagedAttachments) {
            await apiRequest("POST", `/api/contracts/${data.id}/attachments`, {
              fileName: att.fileName,
              fileSize: att.fileSize,
              contentType: att.contentType,
              objectPath: att.objectPath
            });
          }
        } catch {
          toast({
            title: "Attachments warning",
            description: "Contract created but some attachments could not be saved.",
            variant: "destructive"
          });
        }
      }

      setShowCreateDialog(false);
      resetForm();
      
      if (data.firstPaymentResult) {
        if (data.firstPaymentResult.success) {
          toast({
            title: "Recurring payment created",
            description: "Schedule created and first payment processed successfully!"
          });
        } else {
          toast({
            title: "Recurring payment created",
            description: `Schedule created but first payment failed: ${data.firstPaymentResult.message}`,
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Recurring payment created",
          description: "The recurring payment schedule has been set up successfully."
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create recurring payment",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/contracts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setEditingContract(null);
      resetForm();
      toast({
        title: "Recurring payment updated",
        description: "The recurring payment has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update recurring payment",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setDeleteConfirmId(null);
      toast({
        title: "Recurring payment deleted",
        description: "The recurring payment has been deleted."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recurring payment",
        variant: "destructive"
      });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/contracts/${id}/pause`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Recurring payment paused",
        description: "The recurring payment has been paused."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pause recurring payment",
        variant: "destructive"
      });
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/contracts/${id}/resume`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Recurring payment resumed",
        description: "The recurring payment has been resumed."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume recurring payment",
        variant: "destructive"
      });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/contracts/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Recurring payment cancelled",
        description: "The recurring payment has been cancelled."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel recurring payment",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (tenderSettings) {
      const isCardEnabled = tenderSettings.cardRecurring !== false;
      const isAchEnabled = tenderSettings.achRecurring !== false;
      if ((paymentMethodType === "vaulted" || paymentMethodType === "new_card") && !isCardEnabled) {
        if (isAchEnabled) setPaymentMethodType("ach");
      }
      if ((paymentMethodType === "ach" || paymentMethodType === "saved_bank") && !isAchEnabled) {
        if (isCardEnabled) setPaymentMethodType("vaulted");
      }
    }
  }, [tenderSettings]);

  const resetForm = () => {
    setFormData({
      name: "",
      customerId: "",
      mxCardAccountId: "",
      frequency: "monthly",
      numberOfOccurrences: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      processFirstPayment: false,
    });
    setLineItems([{ id: `item-${Date.now()}`, name: "", description: "", price: "" }]);
    setCustomerCards([]);
    setSelectedPlanId("");
    setIncludeTax(true);
    setIsEditingTaxRate(false);
    setCustomTaxRate("");
    setPaymentMethodType("vaulted");
    setNewCardData({ ...emptyCardEntryValues });
    setStagedAttachments([]);
  };

  const uploadAttachment = async (file: globalThis.File) => {
    setIsUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        contentType: file.type,
        size: file.size
      });
      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(err.message || "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      setStagedAttachments(prev => [...prev, {
        id: `staged-${Date.now()}-${Math.random()}`,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        objectPath
      }]);
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchCustomerCards = async (customerId: string) => {
    if (!customerId) {
      setCustomerCards([]);
      return;
    }
    setLoadingCards(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/vaulted-cards`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomerCards(data.cards || []);
      } else {
        setCustomerCards([]);
      }
    } catch {
      setCustomerCards([]);
    } finally {
      setLoadingCards(false);
    }
  };

  const fetchCustomerBanks = async (customerId: string) => {
    if (!customerId) {
      setCustomerBanks([]);
      return;
    }
    setLoadingBanks(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/vaulted-banks`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomerBanks(data.banks || []);
        if (data.banks?.length > 0) {
          setSelectedBankId(String(data.banks[0].id));
        }
      } else {
        setCustomerBanks([]);
      }
    } catch {
      setCustomerBanks([]);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleCustomerChange = (value: string) => {
    setFormData({ ...formData, customerId: value, mxCardAccountId: "" });
    setSelectedBankId("");
    fetchCustomerCards(value);
    fetchCustomerBanks(value);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (contract: Contract) => {
    setFormData({
      name: contract.name,
      customerId: contract.customerId || "",
      mxCardAccountId: contract.mxCardAccountId || "",
      frequency: contract.frequency,
      numberOfOccurrences: contract.numberOfOccurrences?.toString() || "",
      startDate: contract.startDate ? format(new Date(contract.startDate), "yyyy-MM-dd") : "",
      endDate: contract.endDate ? format(new Date(contract.endDate), "yyyy-MM-dd") : "",
      processFirstPayment: false,
    });
    if (contract.paymentMethodType === "saved_bank" && contract.vaultedBankId) {
      setPaymentMethodType("saved_bank");
      setSelectedBankId(contract.vaultedBankId);
    } else if (contract.paymentMethodType === "ach") {
      setPaymentMethodType("ach");
    } else {
      setPaymentMethodType("vaulted");
    }
    setNewCardData({ ...emptyCardEntryValues });
    // Load line items from contract or create a single item with the amount
    if (contract.lineItems && Array.isArray(contract.lineItems) && contract.lineItems.length > 0) {
      setLineItems(contract.lineItems.map((item, index) => ({
        id: `edit-${index}-${Date.now()}`,
        name: item.name,
        description: item.description,
        price: item.price
      })));
    } else {
      // Backward compatibility: create a single item from the total amount
      setLineItems([{ id: `edit-1-${Date.now()}`, name: "Recurring Payment", description: "", price: contract.amount }]);
    }
    if (contract.customerId) {
      fetchCustomerCards(contract.customerId);
      fetchCustomerBanks(contract.customerId);
    }
    setEditingContract(contract);
  };

  // Line item management helpers
  const addLineItem = () => {
    const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setLineItems([...lineItems, { id: newId, name: "", description: "", price: "" }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    // Use total amount including tax for recurring payments
    const finalAmount = totalAmount.toFixed(2);
    // Filter out empty line items and prepare for storage
    const validLineItems = lineItems
      .filter(item => item.name.trim() || parseFloat(item.price) > 0)
      .map(item => ({
        name: item.name,
        description: item.description,
        price: item.price
      }));
    
    let mxCardAccountId = formData.mxCardAccountId;
    
    // If using new card, vault it first
    if (paymentMethodType === "new_card") {
      if (!formData.customerId) {
        toast({
          title: "Customer required",
          description: "Please select a customer before adding a new card",
          variant: "destructive"
        });
        return;
      }
      setVaultingCard(true);
      try {
        const vaultRes = await apiRequest("POST", `/api/customers/${formData.customerId}/vault-card`, {
          cardNumber: newCardData.cardNumber.replace(/\s/g, ''),
          expiryMonth: newCardData.expiryMonth,
          expiryYear: newCardData.expiryYear,
          cvv: newCardData.cvv,
          name: newCardData.cardholderName,
          avsStreet: newCardData.avsStreet,
          avsZip: newCardData.avsZip
        });
        
        if (!vaultRes.ok) {
          const error = await vaultRes.json();
          toast({
            title: "Failed to save card",
            description: error.message || "Could not vault the card. Please check card details.",
            variant: "destructive"
          });
          setVaultingCard(false);
          return;
        }
        
        const vaultedCard = await vaultRes.json();
        mxCardAccountId = String(vaultedCard.id);
        
        fetchCustomerCards(formData.customerId);
        
      } catch (err: any) {
        toast({
          title: "Card vaulting error",
          description: err.message || "An error occurred while saving the card",
          variant: "destructive"
        });
        setVaultingCard(false);
        return;
      }
      setVaultingCard(false);
    }
    
    const data: any = {
      name: formData.name,
      customerId: formData.customerId || null,
      mxCardAccountId: (paymentMethodType === "ach" || paymentMethodType === "saved_bank") ? null : (mxCardAccountId || null),
      amount: finalAmount,
      lineItems: validLineItems.length > 0 ? validLineItems : null,
      frequency: formData.frequency,
      numberOfOccurrences: formData.numberOfOccurrences ? parseInt(formData.numberOfOccurrences, 10) : null,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      nextPaymentDate: new Date(formData.startDate).toISOString(),
      processFirstPayment: formData.processFirstPayment,
    };
    
    if (paymentMethodType === "saved_bank") {
      data.paymentMethodType = "saved_bank";
      data.savedBankAccountId = selectedBankId;
    } else if (paymentMethodType === "ach") {
      data.paymentMethodType = "ach";
      data.achAccountNumber = achData.accountNumber;
      data.achRoutingNumber = achData.routingNumber;
      data.achAccountType = achData.accountType;
      data.achAccountHolderName = achData.accountHolderName;
    }

    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId || !customers) return "No customer";
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return "Unknown";
    const personName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    return personName || customer.company || customer.email || "Unknown";
  };

  const getCustomerField = (customerId: string | null, field: keyof Customer) => {
    if (!customerId || !customers) return null;
    const customer = customers.find((c) => c.id === customerId);
    return customer ? customer[field] : null;
  };

  const formatFrequency = (frequency: string) => {
    const option = frequencyOptions.find((f) => f.value === frequency);
    return option?.label || frequency;
  };

  const opStateCounts: Record<string, number> = {};
  const needsAttentionCount = contracts?.filter(c => {
    const os = getOperationalState(c);
    return os === "agent_liability" || os === "agent_covered" || os === "customer_recovery" || os === "terminal_failure" || os === "retrying";
  }).length ?? 0;

  contracts?.forEach(c => {
    const os = getOperationalState(c);
    opStateCounts[os] = (opStateCounts[os] || 0) + 1;
  });

  const filteredContracts = (contracts?.filter((contract) => {
    const matchesSearch = 
      contract.name.toLowerCase().includes(search.toLowerCase()) ||
      getCustomerName(contract.customerId).toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "attention") {
      const os = getOperationalState(contract);
      return os === "agent_liability" || os === "agent_covered" || os === "customer_recovery" || os === "terminal_failure" || os === "retrying";
    }
    return getOperationalState(contract) === statusFilter;
  }) || []).sort((a, b) => {
    return opStatePriority[getOperationalState(a)] - opStatePriority[getOperationalState(b)];
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Payments</h1>
          <p className="text-sm text-muted-foreground">Manage recurring payment schedules</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-recurring">
          <Plus className="mr-2 h-4 w-4" />
          Create Recurring
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-billed-this-month">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full p-2 bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Billed This Month</p>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-billed-this-month">
                  ${(billingSummary?.billedThisMonth ?? 0).toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-to-be-billed">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full p-2 bg-blue-100 dark:bg-blue-900/30">
              <CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">To Be Billed This Month</p>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-to-be-billed">
                  ${(billingSummary?.toBeBilledThisMonth ?? 0).toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-next-month-total">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-full p-2 bg-purple-100 dark:bg-purple-900/30">
              <CalendarClock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Month Total</p>
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-next-month-total">
                  ${(billingSummary?.nextMonthTotal ?? 0).toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        {needsAttentionCount > 0 && (
          <Card data-testid="card-needs-attention" className="border-red-200 dark:border-red-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-full p-2 bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-needs-attention">
                  {needsAttentionCount}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recurring payments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "all", label: "All", count: contracts?.length ?? 0 },
              ...(needsAttentionCount > 0 ? [{ key: "attention", label: "Needs Attention", count: needsAttentionCount }] : []),
              { key: "healthy_active", label: "Active", count: opStateCounts["healthy_active"] || 0 },
              { key: "retrying", label: "Retrying", count: opStateCounts["retrying"] || 0 },
              { key: "terminal_failure", label: "Failed", count: opStateCounts["terminal_failure"] || 0 },
              { key: "customer_recovery", label: "Recovery", count: opStateCounts["customer_recovery"] || 0 },
              { key: "agent_liability", label: "Liability", count: opStateCounts["agent_liability"] || 0 },
              { key: "agent_covered", label: "Agent Covered", count: opStateCounts["agent_covered"] || 0 },
              { key: "paused", label: "Paused", count: opStateCounts["paused"] || 0 },
              { key: "completed", label: "Completed", count: opStateCounts["completed"] || 0 },
              { key: "cancelled", label: "Cancelled", count: opStateCounts["cancelled"] || 0 },
            ] as { key: string; label: string; count: number }[])
              .filter(f => f.key === "all" || f.key === "attention" || f.count > 0)
              .map(f => (
              <Button
                key={f.key}
                variant={statusFilter === f.key ? "default" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full px-3 h-7 text-xs",
                  statusFilter !== f.key && f.key === "attention" && "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
                  statusFilter !== f.key && (f.key === "agent_liability" || f.key === "customer_recovery" || f.key === "terminal_failure") && "border-red-200 text-red-600 dark:border-red-900 dark:text-red-400",
                  statusFilter !== f.key && f.key === "agent_covered" && "border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-400",
                  statusFilter !== f.key && f.key === "retrying" && "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400",
                )}
                onClick={() => setStatusFilter(statusFilter === f.key ? "all" : f.key)}
                data-testid={`filter-${f.key}`}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-70">{f.count}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {filteredContracts.length} Contract{filteredContracts.length !== 1 ? "s" : ""}
            </span>
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="text-xs font-normal">{statusFilter === "attention" ? "Needs Attention" : opStateLabels[statusFilter as OperationalState] || statusFilter}</Badge>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[180px] text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Contract</TableHead>
              <TableHead className="min-w-[160px] text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Customer</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Amount</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Frequency</TableHead>
              <TableHead className="min-w-[160px] text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Progress</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Next Payment</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="w-[48px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  No recurring payments found
                </TableCell>
              </TableRow>
            ) : (
              filteredContracts.map((contract) => {
                const remaining = contract.numberOfOccurrences
                  ? Math.max(contract.numberOfOccurrences - contract.successfulPayments, 0)
                  : null;
                const collected = (contract.successfulPayments * parseFloat(contract.amount)).toFixed(2);
                const dba = getCustomerField(contract.customerId, "company");
                const acctNum = getCustomerField(contract.customerId, "accountNumber");
                const agent = getCustomerField(contract.customerId, "salesOfficeAgent");

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextDate = contract.nextPaymentDate ? new Date(contract.nextPaymentDate) : null;
                const diffDays = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) : null;
                const isOverdue = diffDays !== null && diffDays < 0 && contract.status === "active";
                const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && contract.status === "active";
                const opState = getOperationalState(contract);

                return (
                <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`} className={cn(
                  opState === "agent_liability" && "bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50",
                  opState === "agent_covered" && "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50",
                  opState === "customer_recovery" && "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50",
                  opState === "terminal_failure" && "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50",
                  opState === "retrying" && "bg-orange-50/50 dark:bg-orange-950/20",
                )}>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[13px] leading-snug">{contract.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        since {formatDateUTC(contract.startDate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate leading-snug">{getCustomerName(contract.customerId)}</span>
                      {(dba || acctNum || agent) && (
                        <span className="text-[11px] text-muted-foreground truncate mt-0.5" data-testid={`text-dba-${contract.id}`}>
                          {[dba, acctNum && `#${acctNum}`, agent].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="font-bold tabular-nums text-[14px]">${parseFloat(contract.amount).toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm text-muted-foreground">{formatFrequency(contract.frequency)}</span>
                  </TableCell>
                  <TableCell className="py-3" data-testid={`text-payments-${contract.id}`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-baseline gap-1 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">{contract.successfulPayments}</span>
                        {contract.numberOfOccurrences ? (
                          <span className="text-muted-foreground text-[12px]">/ {contract.numberOfOccurrences} payments</span>
                        ) : (
                          <span className="text-muted-foreground text-[12px]">paid · ongoing</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">${collected} collected</span>
                      {contract.failedPayments > 0 && (() => {
                        const hasUnresolvedIssue = ["retrying", "terminal_failure", "customer_recovery", "agent_liability", "agent_covered"].includes(opState);
                        return hasUnresolvedIssue ? (
                          <span className="text-[11px] text-red-600 dark:text-red-400 font-medium" data-testid={`text-failed-active-${contract.id}`}>{contract.failedPayments} failed</span>
                        ) : null;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {contract.nextPaymentDate ? (
                      <span className={cn(
                        "text-sm tabular-nums",
                        isOverdue ? "text-red-600 dark:text-red-400 font-semibold" :
                        isDueSoon ? "text-amber-600 dark:text-amber-400 font-medium" :
                        "text-foreground"
                      )}>
                        {isOverdue ? "Overdue · " : isDueSoon ? "Due soon · " : ""}
                        {formatDateUTC(contract.nextPaymentDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      {opState === "agent_liability" ? (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-[11px] px-2 py-0.5" data-testid={`status-liability-${contract.id}`}>
                          Agent Liability
                        </Badge>
                      ) : opState === "agent_covered" ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-[11px] px-2 py-0.5" data-testid={`status-agent-covered-${contract.id}`}>
                          Agent Covered
                        </Badge>
                      ) : opState === "customer_recovery" ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-[11px] px-2 py-0.5" data-testid={`status-recovery-${contract.id}`}>
                          Recovery Pending
                        </Badge>
                      ) : opState === "retrying" ? (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 text-[11px] px-2 py-0.5" data-testid={`status-retrying-${contract.id}`}>
                          Retrying ({contract.consecutiveFailures}/3)
                        </Badge>
                      ) : (
                        <Badge className={`${statusColors[contract.status] || ""} text-[11px] px-2 py-0.5`} data-testid={`status-${contract.status}-${contract.id}`}>
                          {statusLabels[contract.status] || contract.status}
                        </Badge>
                      )}
                      {opState === "terminal_failure" && contract.terminalFailureAt && (
                        <span className="text-[10px] text-red-500 dark:text-red-400 truncate max-w-[120px]" title={contract.lastFailureReason || undefined}>
                          {contract.lastFailureReason ? contract.lastFailureReason.slice(0, 30) + (contract.lastFailureReason.length > 30 ? "…" : "") : "Terminal failure"}
                        </span>
                      )}
                      {contract.recoveryInvoiceId && opState === "customer_recovery" && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">Invoice sent to customer</span>
                      )}
                      {contract.agentLiabilityInvoiceId && opState === "agent_liability" && (
                        <span className="text-[10px] text-purple-600 dark:text-purple-400">
                          {contract.agentLiabilityChargeResult === "success" ? "Charged" : contract.agentLiabilityChargeResult ? `Charge: ${contract.agentLiabilityChargeResult}` : "Pending charge"}
                        </span>
                      )}
                      {opState === "agent_covered" && contract.agentCoveredSince && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400">
                          Since {new Date(contract.agentCoveredSince).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${contract.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailContract(contract)} data-testid={`button-view-details-${contract.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setBillingHistoryContract(contract)} data-testid={`button-billing-history-${contract.id}`}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Billing History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAttachmentsContract(contract)} data-testid={`button-attachments-${contract.id}`}>
                          <Paperclip className="mr-2 h-4 w-4" />
                          Attachments
                        </DropdownMenuItem>
                        {contract.agreementId && (
                          <DropdownMenuItem onClick={() => window.open(`/api/agreements/${contract.agreementId}/download-pdf`, "_blank")} data-testid={`button-view-agreement-${contract.id}`}>
                            <FileSignature className="mr-2 h-4 w-4" />
                            View Agreement
                          </DropdownMenuItem>
                        )}
                        {(contract.status === "active" || contract.status === "paused") && (
                          <DropdownMenuItem
                            onClick={() => runBillingMutation.mutate(contract.id)}
                            data-testid={`button-run-billing-${contract.id}`}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Run Payment Now
                          </DropdownMenuItem>
                        )}
                        {contract.status !== "completed" && contract.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleOpenEdit(contract)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {contract.status === "active" && (
                          <DropdownMenuItem onClick={() => pauseMutation.mutate(contract.id)}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {contract.status === "paused" && (
                          <DropdownMenuItem onClick={() => resumeMutation.mutate(contract.id)}>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        {contract.status !== "completed" && contract.status !== "cancelled" && (
                          <DropdownMenuItem
                            onClick={() => cancelMutation.mutate(contract.id)}
                            className="text-destructive"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        {contract.status !== "completed" && (
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmId(contract.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={showCreateDialog || !!editingContract} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingContract(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-lg">
              {editingContract ? "Edit Recurring Payment" : "Create Recurring Payment"}
            </DialogTitle>
            <DialogDescription>
              {editingContract 
                ? "Update the recurring payment schedule"
                : "Set up a new recurring payment schedule"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {!editingContract && recurringPlans.filter(p => p.isActive).length > 0 && (
              <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/70">
                  <FileSignature className="h-3.5 w-3.5" />
                  Plan Template
                </div>
                <Select
                  value={selectedPlanId}
                  onValueChange={(planId) => {
                    setSelectedPlanId(planId);
                    const plan = recurringPlans.find(p => p.id === planId);
                    if (!plan) return;
                    setFormData(prev => ({
                      ...prev,
                      name: plan.name,
                      frequency: plan.frequency,
                      numberOfOccurrences: plan.numberOfOccurrences?.toString() || "",
                    }));
                    if (plan.lineItems && Array.isArray(plan.lineItems) && plan.lineItems.length > 0) {
                      setLineItems((plan.lineItems as any[]).map((item, i) => ({
                        id: `plan-${i}-${Date.now()}`,
                        name: item.name || "",
                        description: item.description || "",
                        price: item.price?.toString() || "",
                      })));
                    }
                    toast({ title: `Plan "${plan.name}" applied`, description: "Form fields have been pre-filled. You can still adjust them." });
                  }}
                >
                  <SelectTrigger data-testid="select-plan-template">
                    <SelectValue placeholder="Select a plan to auto-fill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recurringPlans.filter(p => p.isActive).map(plan => {
                      const items = (plan.lineItems as any[]) || [];
                      const planTotal = items.reduce((s: number, i: any) => s + (parseFloat(i.price) || 0), 0);
                      return (
                        <SelectItem key={plan.id} value={plan.id} data-testid={`plan-option-${plan.id}`}>
                          {plan.name} - ${planTotal.toFixed(2)} / {frequencyOptions.find(f => f.value === plan.frequency)?.label || plan.frequency}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Contract Details</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Contract Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Monthly Subscription"
                  data-testid="input-contract-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
              {(() => {
                const selectedCustomerData = customers?.find(c => c.id === formData.customerId);
                const filteredCustomers = customers?.filter(customer => {
                  if (!customerSearchQuery) return true;
                  const query = customerSearchQuery.toLowerCase();
                  const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
                  const company = (customer.company || "").toLowerCase();
                  const legalName = (customer.legalCompanyName || "").toLowerCase();
                  const email = (customer.email || "").toLowerCase();
                  const accountNumber = ((customer as any).accountNumber || "").toLowerCase();
                  return fullName.includes(query) || company.includes(query) || legalName.includes(query) || email.includes(query) || accountNumber.includes(query);
                }) || [];

                return (
                  <div className="flex items-start gap-2">
                  <div className="relative flex-1">
                    {!customerSearchOpen && selectedCustomerData ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => setCustomerSearchOpen(true)}
                        data-testid="select-customer"
                      >
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
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    ) : !customerSearchOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between text-muted-foreground"
                        onClick={() => setCustomerSearchOpen(true)}
                        data-testid="select-customer"
                      >
                        Search customers...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoFocus
                              placeholder="Search by name, DBA, legal name, or account #..."
                              value={customerSearchQuery}
                              onChange={(e) => setCustomerSearchQuery(e.target.value)}
                              className="pl-8"
                              data-testid="input-customer-search"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCustomerSearchOpen(false);
                              setCustomerSearchQuery("");
                            }}
                            data-testid="button-close-customer-search"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-1 max-h-[200px] overflow-y-auto rounded-md border bg-popover">
                          {filteredCustomers.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No customers found.
                            </div>
                          ) : (
                            filteredCustomers.map((customer) => (
                              <div
                                key={customer.id}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover-elevate"
                                onClick={() => {
                                  handleCustomerChange(customer.id);
                                  setCustomerSearchOpen(false);
                                  setCustomerSearchQuery("");
                                }}
                                data-testid={`customer-option-${customer.id}`}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    formData.customerId === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {customer.firstName} {customer.lastName}
                                  </span>
                                  {(customer.company || customer.legalCompanyName) && (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {customer.company && `DBA: ${customer.company}`}
                                      {customer.company && customer.legalCompanyName && " • "}
                                      {customer.legalCompanyName && `Legal: ${customer.legalCompanyName}`}
                                    </span>
                                  )}
                                  {customer.email && (
                                    <span className="text-xs text-muted-foreground truncate">{customer.email}</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddingCustomer(true)}
                    data-testid="button-add-new-customer"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  </div>
                );
              })()}
              <NewCustomerDialog
                open={isAddingCustomer}
                onOpenChange={setIsAddingCustomer}
                onCustomerCreated={(customer) => {
                  handleCustomerChange(customer.id);
                }}
              />
              </div>
            </div>

            {formData.customerId && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Payment Method</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                <div className="flex gap-2">
                  {(!tenderSettings || tenderSettings.cardRecurring) && (
                    <Button
                      type="button"
                      variant={paymentMethodType === "vaulted" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPaymentMethodType("vaulted");
                        setFormData({ ...formData, mxCardAccountId: "" });
                      }}
                      className="flex-1"
                      data-testid="button-saved-card"
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      Saved Card
                    </Button>
                  )}
                  {(!tenderSettings || tenderSettings.cardRecurring) && (
                    <Button
                      type="button"
                      variant={paymentMethodType === "new_card" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPaymentMethodType("new_card");
                        setFormData({ ...formData, mxCardAccountId: "" });
                      }}
                      className="flex-1"
                      data-testid="button-new-card"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Card
                    </Button>
                  )}
                  {(!tenderSettings || tenderSettings.achRecurring) && customerBanks.length > 0 && (
                    <Button
                      type="button"
                      variant={paymentMethodType === "saved_bank" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPaymentMethodType("saved_bank");
                        setFormData({ ...formData, mxCardAccountId: "" });
                      }}
                      className="flex-1"
                      data-testid="button-saved-bank"
                    >
                      <Wallet className="h-4 w-4 mr-1" />
                      Saved Bank
                    </Button>
                  )}
                  {(!tenderSettings || tenderSettings.achRecurring) && (
                    <Button
                      type="button"
                      variant={paymentMethodType === "ach" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setPaymentMethodType("ach");
                        setFormData({ ...formData, mxCardAccountId: "" });
                      }}
                      className="flex-1"
                      data-testid="button-ach"
                    >
                      <Building2 className="h-4 w-4 mr-1" />
                      ACH
                    </Button>
                  )}
                </div>

                {paymentMethodType === "saved_bank" && (
                  <div className="space-y-2">
                    <Select
                      value={selectedBankId}
                      onValueChange={setSelectedBankId}
                      disabled={loadingBanks}
                    >
                      <SelectTrigger data-testid="select-saved-bank">
                        {loadingBanks ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading banks...
                          </div>
                        ) : (
                          <SelectValue placeholder="Select saved bank account" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {customerBanks.length > 0 ? (
                          customerBanks.map((bank) => (
                            <SelectItem key={bank.id} value={String(bank.id)}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {bank.bankName || "Bank"} •••• {bank.last4 || "****"}
                                {bank.accountType && ` (${bank.accountType})`}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_banks" disabled>
                            No saved bank accounts available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {paymentMethodType === "vaulted" && (
                  <div className="space-y-2">
                    <Select
                      value={formData.mxCardAccountId}
                      onValueChange={(value) => setFormData({ ...formData, mxCardAccountId: value })}
                      disabled={loadingCards}
                    >
                      <SelectTrigger data-testid="select-payment-method">
                        {loadingCards ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading cards...
                          </div>
                        ) : (
                          <SelectValue placeholder="Select saved card" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {customerCards.length > 0 ? (
                          customerCards.map((card) => {
                            const cardId = String(card.id);
                            const last4 = card.last4 || card.lastFour || (card.number ? card.number.slice(-4) : "****");
                            const brand = card.cardBrand || card.cardType || "Card";
                            const holderName = card.cardholderName || card.name || "";
                            return (
                              <SelectItem key={cardId} value={cardId}>
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4" />
                                  {brand} ending {last4}
                                  {holderName && <span className="text-muted-foreground text-xs">({holderName})</span>}
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="no_cards" disabled>
                            No saved cards available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {customerCards.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        No saved cards found. Use "New Card" to enter card details.
                      </p>
                    )}
                  </div>
                )}

                {paymentMethodType === "new_card" && (
                  <div className="space-y-3 p-3 bg-muted/20 rounded-md">
                    <CardEntryForm
                      values={newCardData}
                      onChange={setNewCardData}
                      idPrefix="rec"
                    />
                    <p className="text-xs text-muted-foreground">
                      This card will be securely saved to the customer's profile for recurring payments
                    </p>
                  </div>
                )}

                {paymentMethodType === "ach" && (
                  <div className="space-y-3 p-3 bg-muted/20 rounded-md">
                    <AchEntryForm
                      values={achData}
                      onChange={setAchData}
                      idPrefix="rec"
                    />
                    <p className="text-xs text-muted-foreground">
                      ACH bank account details will be used for recurring payment processing
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Items Section ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Items</span>
                <div className="h-px flex-1 bg-border" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="h-7 px-2.5 text-xs shrink-0"
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[1fr_90px_32px] gap-0 bg-muted/40 border-b px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Item / Description</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">Amount</span>
                  <span />
                </div>
                {lineItems.map((item, index) => (
                  <div key={item.id} className={`px-3 py-2.5 space-y-1.5 ${index > 0 ? "border-t" : ""}`}>
                    <div className="grid grid-cols-[1fr_90px_32px] gap-2 items-center">
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateLineItem(item.id, "name", e.target.value)}
                        className="h-8 text-sm border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none shadow-none font-medium placeholder:font-normal"
                        data-testid={`input-item-name-${index}`}
                      />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) => updateLineItem(item.id, "price", e.target.value)}
                          className="h-8 text-sm text-right pl-5 tabular-nums"
                          data-testid={`input-item-price-${index}`}
                        />
                      </div>
                      {lineItems.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-remove-item-${index}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : <div />}
                    </div>
                    <Input
                      placeholder="Description (optional)"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      className="h-7 text-xs text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none"
                      data-testid={`input-item-description-${index}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Pricing Summary ── */}
            <div className="rounded-md border bg-muted/20 overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing Summary</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium" data-testid="text-recurring-subtotal">${subtotal.toFixed(2)}</span>
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
                  taxRatePercent={salesTaxRate * 100}
                  defaultTaxRatePercent={defaultSalesTaxRate * 100}
                  taxAmount={taxAmount}
                  formatAmount={(n) => `$${n.toFixed(2)}`}
                  testIdPrefix="recurring-tax"
                />
              </div>
              {recurPricingResult.adjustmentAmount > 0 && (
                <div className="px-4 py-2 border-t flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
                  <span data-testid="text-recurring-adjustment-label">{recurPricingResult.adjustmentLabel}</span>
                  <span className="font-medium tabular-nums" data-testid="text-recurring-adjustment-amount">+${recurPricingResult.adjustmentAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="px-4 py-3 bg-primary/5 border-t flex justify-between items-center">
                <span className="text-sm font-semibold">Total per Payment</span>
                <span className="text-base font-bold tabular-nums tracking-tight" data-testid="text-recurring-total">${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* ── Schedule Section ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Schedule</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger data-testid="select-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfOccurrences"># of Payments</Label>
                  <Input
                    id="numberOfOccurrences"
                    type="number"
                    min="1"
                    value={formData.numberOfOccurrences}
                    onChange={(e) => setFormData({ ...formData, numberOfOccurrences: e.target.value })}
                    placeholder="Leave blank for unlimited"
                    data-testid="input-occurrences"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    placeholder="Optional"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Set number of payments OR an end date to limit the schedule — leave both blank for ongoing billing.
              </p>
            </div>

            {!editingContract && (formData.mxCardAccountId || (paymentMethodType === "new_card" && newCardData.cardNumber) || (paymentMethodType === "ach" && achData.accountNumber) || (paymentMethodType === "saved_bank" && selectedBankId)) && (
              <label htmlFor="processFirstPayment" className="flex items-start gap-3 p-3 rounded-md border border-border hover:border-primary/40 bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors select-none">
                <Checkbox
                  id="processFirstPayment"
                  checked={formData.processFirstPayment}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, processFirstPayment: checked === true })
                  }
                  className="mt-0.5 shrink-0"
                  data-testid="checkbox-process-first-payment"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">Process first payment immediately</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Charge <span className="font-semibold tabular-nums text-foreground">${totalAmount.toFixed(2)}</span> to the{" "}
                    {paymentMethodType === "new_card" ? "new card" : paymentMethodType === "ach" ? "bank account" : paymentMethodType === "saved_bank" ? "saved bank account" : "selected card"}{" "}
                    now, then continue on schedule
                  </span>
                </div>
              </label>
            )}
            {!editingContract && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Attachments</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="flex items-center gap-2 sr-only">
                    <Paperclip className="h-4 w-4" />
                    Attachments
                  </Label>
                  <label htmlFor="recurring-attachment-upload">
                    <input
                      id="recurring-attachment-upload"
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
                      data-testid="input-recurring-attachment-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => document.getElementById("recurring-attachment-upload")?.click()}
                      data-testid="button-upload-recurring-attachment"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploading ? "Uploading..." : "Upload File"}
                    </Button>
                  </label>
                </div>
                {stagedAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No attachments yet. Upload files for record-keeping.</p>
                ) : (
                  <div className="space-y-2">
                    {stagedAttachments.map((att) => {
                      const isImage = (att.contentType || "").startsWith("image/");
                      const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : null;
                      return (
                        <div
                          key={att.id}
                          className="flex items-center gap-3 p-2 rounded-md border"
                          data-testid={`recurring-attachment-item-${att.id}`}
                        >
                          {isImage ? (
                            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.fileName}</p>
                            {sizeKB && (
                              <p className="text-xs text-muted-foreground">{sizeKB} KB</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setStagedAttachments(prev => prev.filter(a => a.id !== att.id))}
                            data-testid={`button-delete-recurring-attachment-${att.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t mt-2">
            <div className="flex-1 text-xs text-muted-foreground hidden sm:flex items-center">
              {totalAmount > 0 && (
                <span>
                  <span className="font-medium tabular-nums">${totalAmount.toFixed(2)}</span>
                  {formData.frequency ? ` · ${formatFrequency(formData.frequency)}` : ""}
                  {formData.numberOfOccurrences ? ` · ${formData.numberOfOccurrences} payments` : ""}
                </span>
              )}
            </div>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingContract(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              size="default"
              className="min-w-[130px]"
              disabled={
                !formData.name || 
                subtotal <= 0 || 
                !formData.startDate || 
                !formData.customerId || 
                (paymentMethodType === "vaulted" && !formData.mxCardAccountId) ||
                (paymentMethodType === "new_card" && (!newCardData.cardNumber || !newCardData.expiryMonth || !newCardData.expiryYear || !newCardData.cvv || !newCardData.cardholderName || !newCardData.avsZip)) ||
                (paymentMethodType === "ach" && (!achData.accountNumber || !achData.routingNumber || !achData.accountHolderName)) ||
                (paymentMethodType === "saved_bank" && !selectedBankId) ||
                createMutation.isPending || 
                updateMutation.isPending ||
                vaultingCard
              }
              data-testid="button-save-recurring"
            >
              {vaultingCard ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Card...
                </>
              ) : createMutation.isPending || updateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingContract ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailContract} onOpenChange={(open) => !open && setDetailContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-contract-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Contract Details
              {detailContract && (() => {
                const os = getOperationalState(detailContract);
                const badgeClass = os === "agent_liability" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                  : os === "agent_covered" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  : os === "customer_recovery" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                  : os === "retrying" ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                  : statusColors[detailContract.status] || "";
                return <Badge className={`${badgeClass} text-[11px] px-2 py-0.5`}>{opStateLabels[os]}</Badge>;
              })()}
            </DialogTitle>
            <DialogDescription>{detailContract?.name}</DialogDescription>
          </DialogHeader>
          {detailContract && (() => {
            const os = getOperationalState(detailContract);
            return (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Customer:</span> {getCustomerName(detailContract.customerId)}</div>
                      <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">${parseFloat(detailContract.amount).toFixed(2)}</span></div>
                      <div><span className="text-muted-foreground">Frequency:</span> {formatFrequency(detailContract.frequency)}</div>
                      <div><span className="text-muted-foreground">Start:</span> {formatDateUTC(detailContract.startDate)}</div>
                      <div><span className="text-muted-foreground">Successful:</span> <span className="text-green-600 font-medium">{detailContract.successfulPayments}</span></div>
                      <div><span className="text-muted-foreground">Failed:</span> <span className="text-red-600 font-medium">{detailContract.failedPayments}</span></div>
                      {detailContract.nextPaymentDate && (
                        <div><span className="text-muted-foreground">Next Payment:</span> {formatDateUTC(detailContract.nextPaymentDate)}</div>
                      )}
                      {detailContract.consecutiveFailures > 0 && (
                        <div><span className="text-muted-foreground">Consecutive Failures:</span> <span className="text-red-600 font-semibold">{detailContract.consecutiveFailures}/3</span></div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {detailContract.lastFailureReason && (
                  <Card className="border-red-200 dark:border-red-900">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">Last Failure Reason</p>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{detailContract.lastFailureReason}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(os === "terminal_failure" || os === "customer_recovery" || os === "agent_liability" || os === "agent_covered") && (
                  <Card className={cn(
                    "border-l-4",
                    os === "agent_covered" ? "border-l-blue-500" : os === "agent_liability" ? "border-l-purple-500" : os === "customer_recovery" ? "border-l-amber-500" : "border-l-red-500"
                  )}>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className={cn("h-4 w-4",
                          os === "agent_covered" ? "text-blue-500" : os === "agent_liability" ? "text-purple-500" : os === "customer_recovery" ? "text-amber-500" : "text-red-500"
                        )} />
                        Terminal Failure Details
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {detailContract.terminalFailureAt && (
                          <div><span className="text-muted-foreground">Failed At:</span> {format(new Date(detailContract.terminalFailureAt), "MMM d, yyyy h:mm a")}</div>
                        )}
                        {detailContract.terminalFailureAmount && (
                          <div><span className="text-muted-foreground">Failed Amount:</span> ${parseFloat(detailContract.terminalFailureAmount).toFixed(2)}</div>
                        )}
                        {detailContract.terminalFailureAgentName && (
                          <div className="col-span-2"><span className="text-muted-foreground">Linked Agent:</span> {detailContract.terminalFailureAgentName}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {os === "customer_recovery" && (
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4 text-amber-500" />
                        Customer Recovery
                      </h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          {detailContract.customerRecoveryEmailSentAt ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-500" />
                              <span>Recovery email sent {format(new Date(detailContract.customerRecoveryEmailSentAt), "MMM d, yyyy h:mm a")}</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Recovery email pending</span>
                            </>
                          )}
                        </div>
                        {detailContract.customerRecoveryEmailLastError && (
                          <div className="text-red-600 text-xs">Email error: {detailContract.customerRecoveryEmailLastError}</div>
                        )}
                        {detailContract.recoveryInvoiceId && (
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-3.5 w-3.5 text-amber-500" />
                            <span>Recovery invoice created</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {os === "agent_liability" && (
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-purple-500" />
                        Agent Liability
                      </h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {detailContract.agentLiabilityInvoiceId && (
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-3.5 w-3.5 text-purple-500" />
                            <span>Liability invoice created</span>
                          </div>
                        )}
                        {detailContract.agentLiabilityNotifiedAt && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-green-500" />
                            <span>Agent notified {format(new Date(detailContract.agentLiabilityNotifiedAt), "MMM d, yyyy h:mm a")}</span>
                          </div>
                        )}
                        {detailContract.agentLiabilityChargeAttemptedAt && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-purple-500" />
                            <span>
                              Charge attempted {format(new Date(detailContract.agentLiabilityChargeAttemptedAt), "MMM d, yyyy h:mm a")}
                              {detailContract.agentLiabilityChargeResult && (
                                <Badge className={cn("ml-2 text-[10px] px-1.5 py-0",
                                  detailContract.agentLiabilityChargeResult === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                                  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                )}>{detailContract.agentLiabilityChargeResult}</Badge>
                              )}
                            </span>
                          </div>
                        )}
                        {!detailContract.agentLiabilityChargeAttemptedAt && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Auto-charge pending (daily sweep)</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {os === "agent_covered" && (
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        Agent-Covered Billing
                      </h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                          <span>Future billing cycles are being charged to the linked agent's card</span>
                        </div>
                        {detailContract.agentCoveredSince && (
                          <div className="text-muted-foreground text-xs">
                            Agent-covered since {format(new Date(detailContract.agentCoveredSince), "MMM d, yyyy h:mm a")}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          When the customer updates their payment method, billing will automatically revert to the customer.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDetailContract(null); setBillingHistoryContract(detailContract); }} data-testid="button-detail-billing-history">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Billing History
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!billingHistoryContract} onOpenChange={(open) => !open && setBillingHistoryContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing History</DialogTitle>
            <DialogDescription>
              {billingHistoryContract?.name} - Payment history and scheduled billing runs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {billingHistoryContract && (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge className={statusColors[billingHistoryContract.status] || ""}>
                        {billingHistoryContract.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      ${parseFloat(billingHistoryContract.amount).toFixed(2)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Successful:</span>{" "}
                      <span className="text-green-600 font-medium">{billingHistoryContract.successfulPayments}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>{" "}
                      <span className="text-red-600 font-medium">{billingHistoryContract.failedPayments}</span>
                    </div>
                    {billingHistoryContract.nextPaymentDate && (
                      <div>
                        <span className="text-muted-foreground">Next Payment:</span>{" "}
                        {formatDateUTC(billingHistoryContract.nextPaymentDate)}
                      </div>
                    )}
                    {billingHistoryContract.lastFailureReason && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last Failure:</span>{" "}
                        <span className="text-red-600">{billingHistoryContract.lastFailureReason}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h3 className="font-medium">Payment Runs</h3>
              {billingHistoryContract && (billingHistoryContract.status === "active" || billingHistoryContract.status === "paused") && (
                <Button
                  size="sm"
                  onClick={() => runBillingMutation.mutate(billingHistoryContract.id)}
                  disabled={runBillingMutation.isPending}
                  data-testid="button-run-billing-now"
                >
                  {runBillingMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Run Payment Now
                </Button>
              )}
            </div>

            {billingRunsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading billing history...</div>
            ) : !billingRuns || billingRuns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No billing runs yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingRuns.map((run) => (
                    <TableRow key={run.id} data-testid={`row-billing-run-${run.id}`}>
                      <TableCell>{format(new Date(run.processedAt), "MMM d, yyyy h:mm a")}</TableCell>
                      <TableCell>${parseFloat(run.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={
                          run.status === "success"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : run.status === "skipped"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        }>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {run.status === "success"
                          ? run.mxPaymentId ? `Payment #${run.mxPaymentId}` : "Payment processed"
                          : run.errorMessage || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attachmentsContract} onOpenChange={(open) => !open && setAttachmentsContract(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-contract-attachments">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </DialogTitle>
            <DialogDescription>
              {attachmentsContract?.name} - Manage attached files
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {contractAttachments.length} file(s) attached
              </p>
              <label htmlFor="contract-attachment-upload">
                <input
                  id="contract-attachment-upload"
                  type="file"
                  className="hidden"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || !attachmentsContract) return;
                    setAttachmentUploading(true);
                    try {
                      for (const file of Array.from(files)) {
                        const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
                          name: file.name,
                          contentType: file.type,
                          size: file.size
                        });
                        if (!urlRes.ok) {
                          const err = await urlRes.json();
                          throw new Error(err.message || "Failed to get upload URL");
                        }
                        const { uploadURL, objectPath } = await urlRes.json();
                        const uploadRes = await fetch(uploadURL, {
                          method: "PUT",
                          headers: { "Content-Type": file.type },
                          body: file
                        });
                        if (!uploadRes.ok) throw new Error("Upload failed");
                        await apiRequest("POST", `/api/contracts/${attachmentsContract.id}/attachments`, {
                          fileName: file.name,
                          fileSize: file.size,
                          contentType: file.type,
                          objectPath
                        });
                      }
                      queryClient.invalidateQueries({ queryKey: ["/api/contracts", attachmentsContract.id, "attachments"] });
                      toast({ title: "Uploaded", description: "File(s) attached successfully" });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err.message || "Could not upload file", variant: "destructive" });
                    } finally {
                      setAttachmentUploading(false);
                    }
                    e.target.value = "";
                  }}
                  data-testid="input-contract-attachment-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={attachmentUploading}
                  onClick={() => document.getElementById("contract-attachment-upload")?.click()}
                  data-testid="button-upload-contract-attachment"
                >
                  {attachmentUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {attachmentUploading ? "Uploading..." : "Upload File"}
                </Button>
              </label>
            </div>

            {attachmentsLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading attachments...</div>
            ) : attachmentsError ? (
              <div className="text-center py-6 text-destructive">
                <p className="text-sm">Failed to load attachments</p>
              </div>
            ) : contractAttachments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No attachments yet</p>
                <p className="text-xs mt-1">Upload files for record-keeping</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contractAttachments.map((att) => {
                  const isImage = (att.contentType || "").startsWith("image/");
                  const sizeKB = att.fileSize ? (att.fileSize / 1024).toFixed(1) : null;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 rounded-md border"
                      data-testid={`contract-attachment-item-${att.id}`}
                    >
                      {isImage ? (
                        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {sizeKB && <span>{sizeKB} KB</span>}
                          {att.createdAt && <span>{format(new Date(att.createdAt), "MMM d, yyyy")}</span>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!attachmentsContract) return;
                          try {
                            await apiRequest("DELETE", `/api/contracts/${attachmentsContract.id}/attachments/${att.id}`);
                            queryClient.invalidateQueries({ queryKey: ["/api/contracts", attachmentsContract.id, "attachments"] });
                            toast({ title: "Deleted", description: "Attachment removed" });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
                          }
                        }}
                        data-testid={`button-delete-contract-attachment-${att.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the recurring payment schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
