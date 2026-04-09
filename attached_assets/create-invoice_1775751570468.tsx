import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useParams } from "wouter";
import { PageHeader } from "@/components/page-header";
import { TaxControl } from "@/components/tax-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardEntryForm, CardEntryValues, emptyCardEntryValues } from "@/components/card-entry-form";
import { AchEntryForm, AchEntryValues, emptyAchEntryValues } from "@/components/ach-entry-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
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
  Trash2,
  Loader2,
  FileText,
  Send,
  CreditCard,
  Package,
  UserPlus,
  Hash,
  Search,
  Check,
  ChevronsUpDown,
  Building2,
  X,
  Wallet,
  Monitor,
  XCircle,
  Banknote,
  Receipt,
  MapPin,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Customer, InventoryItem, InventorySerialNumber, InvoiceAttachment, InventoryModifier } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { calculateTenderAdjustment, extractAdjustmentSettings } from "@shared/pricing-engine";
import { Paperclip, Download, File as FileIcon, Image as ImageIcon, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { NewCustomerDialog } from "@/components/new-customer-dialog";

interface VaultedCard {
  id: string;
  last4?: string;
  lastFour?: string;
  cardType?: string;
  cardBrand?: string;
  expiryMonth?: string;
  expiryYear?: string;
  expMonth?: string;
  expYear?: string;
  name?: string;
  cardholderName?: string;
  token?: string;
  cardId?: string;
  avsStreet?: string;
  avsZip?: string;
  isDefault?: boolean;
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

interface LineItem {
  id: string;
  inventoryItemId?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitDiscount: number;
  total: number;
  selectedSerialNumbers?: string[];
}

interface StagedAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  objectPath: string;
}


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function CreateInvoicePage() {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const isEditing = !!invoiceId;
  
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString(36).toUpperCase()}`);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isPayNowOpen, setIsPayNowOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const savedInvoiceIdRef = useRef<string | null>(invoiceId || null);
  
  const [newItem, setNewItem] = useState({
    inventoryItemId: "",
    name: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    unitDiscount: 0,
    selectedSerialNumbers: [] as string[]
  });
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySearchOpen, setInventorySearchOpen] = useState(false);
  const [availableSerials, setAvailableSerials] = useState<InventorySerialNumber[]>([]);
  const [serialSearch, setSerialSearch] = useState("");
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false);
  const [pendingModifierItem, setPendingModifierItem] = useState<InventoryItem | null>(null);
  const [selectedModifierIds, setSelectedModifierIds] = useState<Set<string>>(new Set());
  const [pendingModifierNewItem, setPendingModifierNewItem] = useState<typeof newItem | null>(null);
  const [confirmedModifierIds, setConfirmedModifierIds] = useState<Set<string>>(new Set());
  const [includeTax, setIncludeTax] = useState(true);
  const [isEditingTaxRate, setIsEditingTaxRate] = useState(false);
  const [customTaxRate, setCustomTaxRate] = useState<string>("");
  const [isZipTaxMode, setIsZipTaxMode] = useState(false);
  const [taxZipCode, setTaxZipCode] = useState("");
  const [zipTaxRegion, setZipTaxRegion] = useState("");
  const [zipTaxLoading, setZipTaxLoading] = useState(false);
  const [zipTaxError, setZipTaxError] = useState("");

  const inventoryLiteEnabled = tenant?.inventoryLiteEnabled;
  const defaultTaxRateDecimal = tenant?.salesTaxRate ? parseFloat(tenant.salesTaxRate) : 0;
  const parsedCustomRate = customTaxRate !== "" ? parseFloat(customTaxRate) : NaN;
  const taxRateDecimal = !isNaN(parsedCustomRate) && parsedCustomRate >= 0 && parsedCustomRate <= 100
    ? parsedCustomRate / 100 
    : defaultTaxRateDecimal;
  const taxRatePercent = taxRateDecimal * 100;

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"]
  });

  const { data: inventoryItems } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    enabled: inventoryLiteEnabled === true
  });

  const { data: allModifiers } = useQuery<InventoryModifier[]>({
    queryKey: ["/api/inventory/modifiers"],
    enabled: inventoryLiteEnabled === true
  });

  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery<any>({
    queryKey: [`/api/invoices/${invoiceId}`],
    enabled: isEditing
  });

  const { data: attachments = [] } = useQuery<InvoiceAttachment[]>({
    queryKey: ["/api/invoices", invoiceId, "attachments"],
    enabled: isEditing && !!invoiceId
  });

  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

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

      if (isEditing && invoiceId) {
        await apiRequest("POST", `/api/invoices/${invoiceId}/attachments`, {
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          objectPath
        });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId, "attachments"] });
      } else {
        setStagedAttachments(prev => [...prev, {
          id: generateId(),
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          objectPath
        }]);
      }
      toast({ title: "File attached successfully" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/invoices/${invoiceId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId, "attachments"] });
      toast({ title: "Attachment removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (isEditing && existingInvoice && !isLoaded) {
      setInvoiceNumber(existingInvoice.invoiceNumber || "");
      setSelectedCustomerId(existingInvoice.customerId || "");
      setNotes(existingInvoice.notes || "");
      if (existingInvoice.dueDate) {
        const d = new Date(existingInvoice.dueDate);
        setDueDate(d.toISOString().split("T")[0]);
      }
      
      if (existingInvoice.items && Array.isArray(existingInvoice.items)) {
        const items: LineItem[] = existingInvoice.items.map((item: any) => ({
          id: item.id || generateId(),
          inventoryItemId: item.productId,
          name: item.name || item.description,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice) || 0,
          unitDiscount: parseFloat(item.unitDiscount) || 0,
          total: parseFloat(item.amount) || 0
        }));
        setLineItems(items);
      }
      setIsLoaded(true);
    }
  }, [isEditing, existingInvoice, isLoaded]);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  const filteredCustomers = customers?.filter(customer => {
    if (!customerSearch.trim()) return true;
    const search = customerSearch.toLowerCase();
    const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase();
    const company = (customer.company || "").toLowerCase();
    const legalName = ((customer as any).legalCompanyName || "").toLowerCase();
    const email = (customer.email || "").toLowerCase();
    const accountNumber = (customer.accountNumber || "").toLowerCase();
    return fullName.includes(search) || company.includes(search) || legalName.includes(search) || email.includes(search) || accountNumber.includes(search);
  }) || [];

  const { data: tenderSettings } = useQuery<any>({
    queryKey: ["/api/settings/tenders"]
  });

  const { data: terminals } = useQuery<any[]>({
    queryKey: ["/api/terminals"]
  });

  const { data: vaultedCards = [], isLoading: loadingCards } = useQuery<VaultedCard[]>({
    queryKey: ["/api/customers", selectedCustomerId, "vaulted-cards"],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const res = await fetch(`/api/customers/${selectedCustomerId}/vaulted-cards`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.cards || [];
    },
    enabled: !!selectedCustomerId,
    staleTime: 60000
  });

  const { data: vaultedBanks = [], isLoading: loadingBanks } = useQuery<VaultedBank[]>({
    queryKey: ["/api/customers", selectedCustomerId, "vaulted-banks"],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const res = await fetch(`/api/customers/${selectedCustomerId}/vaulted-banks`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.banks || [];
    },
    enabled: !!selectedCustomerId,
    staleTime: 60000
  });


  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = lineItems.reduce((sum, item) => sum + (item.unitDiscount * item.quantity), 0);
  const taxAmount = includeTax ? subtotal * taxRateDecimal : 0;
  const grandTotal = subtotal + taxAmount;

  const handleInventoryItemSelect = async (itemId: string) => {
    const item = inventoryItems?.find(i => i.id === itemId);
    if (item) {
      setSelectedInventoryItem(item);
      const baseNewItem = {
        inventoryItemId: itemId,
        name: item.name,
        description: item.description || "",
        quantity: 1,
        unitPrice: parseFloat(item.price) || 0,
        unitDiscount: 0,
        selectedSerialNumbers: [] as string[]
      };
      setNewItem(baseNewItem);
      
      // If item tracks serial numbers, fetch available serials
      if (item.trackSerialNumbers) {
        try {
          const response = await fetch(`/api/inventory/items/${itemId}/serial-numbers`);
          if (response.ok) {
            const serials = await response.json();
            setAvailableSerials(serials.filter((s: InventorySerialNumber) => s.status === "available"));
          }
        } catch (error) {
          console.error("Failed to fetch serial numbers:", error);
        }
      } else {
        setAvailableSerials([]);
      }

      const itemModifiers = allModifiers?.filter(m => m.itemId === item.id && m.isActive) || [];
      if (itemModifiers.length > 0) {
        setPendingModifierItem(item);
        setPendingModifierNewItem(baseNewItem);
        const requiredIds = new Set(itemModifiers.filter(m => m.isRequired).map(m => m.id));
        setSelectedModifierIds(requiredIds);
        setIsModifierDialogOpen(true);
      }
    }
  };

  const confirmInvoiceModifiers = () => {
    if (!pendingModifierItem || !pendingModifierNewItem) return;
    const itemMods = allModifiers?.filter(m => m.itemId === pendingModifierItem.id && m.isActive) || [];
    const selected = itemMods.filter(m => selectedModifierIds.has(m.id));
    const modTotal = selected.reduce((s, m) => s + parseFloat(m.price || "0"), 0);
    const modNames = selected.map(m => m.name).join(", ");
    const baseDescription = pendingModifierNewItem.description?.replace(/\s*\|\s*Add-ons:.*$/, "") || "";
    
    setNewItem({
      ...pendingModifierNewItem,
      unitPrice: parseFloat(((parseFloat(pendingModifierItem.price) || 0) + modTotal).toFixed(2)),
      description: modNames
        ? (baseDescription ? `${baseDescription} | Add-ons: ${modNames}` : `Add-ons: ${modNames}`)
        : baseDescription
    });
    setConfirmedModifierIds(new Set(selectedModifierIds));
    
    setIsModifierDialogOpen(false);
    setPendingModifierItem(null);
    setPendingModifierNewItem(null);
  };

  const toggleSerialSelection = (serialNumber: string) => {
    const current = newItem.selectedSerialNumbers || [];
    if (current.includes(serialNumber)) {
      setNewItem({
        ...newItem,
        selectedSerialNumbers: current.filter(s => s !== serialNumber),
        quantity: Math.max(1, current.length - 1)
      });
    } else {
      setNewItem({
        ...newItem,
        selectedSerialNumbers: [...current, serialNumber],
        quantity: current.length + 1
      });
    }
  };

  const addLineItem = () => {
    if (!newItem.name || newItem.unitPrice <= 0) {
      toast({
        title: "Missing information",
        description: "Please enter a product name and price.",
        variant: "destructive"
      });
      return;
    }

    // Validate serial numbers for items that track them
    if (selectedInventoryItem?.trackSerialNumbers) {
      if (newItem.selectedSerialNumbers.length === 0) {
        toast({
          title: "Serial numbers required",
          description: "Please select at least one serial number for this item.",
          variant: "destructive"
        });
        return;
      }
      if (newItem.selectedSerialNumbers.length !== newItem.quantity) {
        toast({
          title: "Serial number mismatch",
          description: `You must select exactly ${newItem.quantity} serial number(s).`,
          variant: "destructive"
        });
        return;
      }
    }

    const effectivePrice = Math.max(0, newItem.unitPrice - newItem.unitDiscount);
    const itemTotal = effectivePrice * newItem.quantity;
    
    setLineItems([...lineItems, {
      id: generateId(),
      inventoryItemId: newItem.inventoryItemId || undefined,
      name: newItem.name,
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      unitDiscount: newItem.unitDiscount,
      total: itemTotal,
      selectedSerialNumbers: newItem.selectedSerialNumbers.length > 0 ? newItem.selectedSerialNumbers : undefined
    }]);

    resetNewItem();
    setIsAddingItem(false);
  };

  const resetNewItem = () => {
    setNewItem({
      inventoryItemId: "",
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      unitDiscount: 0,
      selectedSerialNumbers: []
    });
    setSelectedInventoryItem(null);
    setAvailableSerials([]);
    setSerialSearch("");
    setPendingModifierItem(null);
    setPendingModifierNewItem(null);
    setSelectedModifierIds(new Set());
    setConfirmedModifierIds(new Set());
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      const effectivePrice = Math.max(0, updated.unitPrice - updated.unitDiscount);
      updated.total = effectivePrice * updated.quantity;
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id));
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (action: "send" | "pay" | "save" | "save_and_pay") => {
      if (!selectedCustomerId) {
        throw new Error("Please select a customer");
      }
      if (lineItems.length === 0) {
        throw new Error("Please add at least one line item");
      }

      const invoiceData = {
        customerId: selectedCustomerId,
        invoiceNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: totalDiscount.toFixed(2),
        totalAmount: grandTotal.toFixed(2),
        notes,
        dueDate: dueDate || undefined,
        status: action === "send" ? "sent" : (existingInvoice?.status || "draft"),
        items: lineItems.map(item => ({
          productId: item.inventoryItemId || null,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitDiscount: item.unitDiscount,
          amount: item.total,
          selectedSerialNumbers: item.selectedSerialNumbers || null
        }))
      };

      let invoice;
      if (isEditing) {
        const res = await apiRequest("PUT", `/api/invoices/${invoiceId}`, invoiceData);
        invoice = await res.json();
      } else {
        const res = await apiRequest("POST", "/api/invoices", invoiceData);
        invoice = await res.json();
      }
      savedInvoiceIdRef.current = invoice.id;
      
      if (action === "send") {
        await apiRequest("POST", `/api/invoices/${invoice.id}/send`);
      }

      let attachmentFailures: string[] = [];
      if (!isEditing && stagedAttachments.length > 0) {
        for (const att of stagedAttachments) {
          try {
            await apiRequest("POST", `/api/invoices/${invoice.id}/attachments`, {
              fileName: att.fileName,
              fileSize: att.fileSize,
              contentType: att.contentType,
              objectPath: att.objectPath
            });
          } catch (e) {
            console.error("Failed to save attachment:", att.fileName, e);
            attachmentFailures.push(att.fileName);
          }
        }
        setStagedAttachments([]);
        queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoice.id, "attachments"] });
      }
      
      return { invoice, action, attachmentFailures };
    },
    onSuccess: ({ action, attachmentFailures }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });

      if (attachmentFailures && attachmentFailures.length > 0) {
        toast({
          title: "Some attachments failed to save",
          description: `Failed: ${attachmentFailures.join(", ")}. You can re-upload them from the invoice edit page.`,
          variant: "destructive"
        });
      }
      
      if (action === "send") {
        toast({
          title: "Invoice sent",
          description: isEditing ? "The invoice has been updated and sent." : "The invoice has been created and sent to the customer."
        });
        setLocation("/invoices");
      } else if (action === "save") {
        toast({
          title: "Invoice updated",
          description: "The invoice has been updated successfully."
        });
        setLocation("/invoices");
      } else if (action === "save_and_pay") {
        toast({
          title: "Invoice saved",
          description: "Invoice saved. Enter payment details below."
        });
        setIsPayNowOpen(true);
      } else {
        toast({
          title: isEditing ? "Invoice updated" : "Invoice created",
          description: isEditing ? "The invoice has been updated." : "The invoice has been saved as a draft."
        });
        if (!isEditing) {
          setIsPayNowOpen(true);
        } else {
          setLocation("/invoices");
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create invoice.",
        variant: "destructive"
      });
    }
  });

  const invoiceAdjSettings = extractAdjustmentSettings(tenant);
  const payNowMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const tenderForAdj = (paymentData.tenderType || "Card").toLowerCase();
      const invPr = calculateTenderAdjustment({
        baseAmount: grandTotal,
        tax: 0,
        tenderType: tenderForAdj === "ach" ? "ach" : tenderForAdj === "terminal" ? "terminal" : "card",
        adjustmentSettings: invoiceAdjSettings,
      });
      const res = await apiRequest("POST", "/api/mx/payments", {
        amount: invPr.total,
        tenderType: paymentData.tenderType || "Card",
        customerId: selectedCustomerId,
        adjustmentAmount: invPr.adjustmentAmount > 0 ? invPr.adjustmentAmount : undefined,
        adjustmentType: invPr.adjustmentType || undefined,
        adjustmentLabel: invPr.adjustmentLabel || undefined,
        ...paymentData
      });
      const response = await res.json();
      if (response && response.success === false) {
        throw new Error(response.message || "Payment processing failed");
      }
      return response;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      const targetInvoiceId = savedInvoiceIdRef.current || invoiceId;
      if (targetInvoiceId) {
        try {
          await apiRequest("POST", `/api/invoices/${targetInvoiceId}/mark-paid`, {
            paidAmount: grandTotal.toFixed(2)
          });
          queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
        } catch (e) {
          console.error("Failed to mark invoice as paid:", e);
        }
      }
      toast({
        title: "Payment processed",
        description: "The invoice has been paid successfully."
      });
      setIsPayNowOpen(false);
      setLocation("/transactions");
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error?.message || "Failed to process payment.",
        variant: "destructive"
      });
    }
  });

  if (isEditing && isLoadingInvoice) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title={isEditing ? "Edit Invoice" : "Create Invoice"}
        description={isEditing ? `Editing invoice ${invoiceNumber}` : "Create a new invoice with line items"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invoice number */}
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  Invoice Number
                </label>
                <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <span className="px-3 text-sm text-muted-foreground bg-muted/40 border-r h-10 flex items-center select-none">INV</span>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="border-0 rounded-none focus-visible:ring-0 shadow-none"
                    placeholder="Invoice Number"
                    data-testid="input-invoice-number"
                  />
                </div>
              </div>

              {/* Customer */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Customer *</label>
                </div>
                <div className="flex rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={customerPopoverOpen}
                        className={cn("flex-1 justify-between rounded-none border-0 border-r h-10 focus-visible:ring-0 font-normal", !selectedCustomer && "text-muted-foreground")}
                        data-testid="select-customer"
                      >
                        {selectedCustomer ? (
                          <span className="truncate">
                            {selectedCustomer.firstName} {selectedCustomer.lastName}
                            {selectedCustomer.company && ` — ${selectedCustomer.company}`}
                          </span>
                        ) : (
                          "Search customers..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search by name, DBA, legal name, or account #..."
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          data-testid="input-customer-search"
                        />
                        <CommandList>
                          <CommandEmpty>No customers found.</CommandEmpty>
                          <CommandGroup>
                            {filteredCustomers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => {
                                  setSelectedCustomerId(customer.id);
                                  setCustomerPopoverOpen(false);
                                  setCustomerSearch("");
                                }}
                                data-testid={`customer-option-${customer.id}`}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">
                                      {customer.firstName} {customer.lastName}
                                    </span>
                                    {customer.email && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {customer.email}
                                      </span>
                                    )}
                                  </div>
                                  {(customer.company || (customer as any).legalCompanyName) && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Building2 className="h-3 w-3" />
                                      <span className="truncate">
                                        {customer.company && `DBA: ${customer.company}`}
                                        {customer.company && (customer as any).legalCompanyName && " | "}
                                        {(customer as any).legalCompanyName && `Legal: ${(customer as any).legalCompanyName}`}
                                      </span>
                                    </div>
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
                    data-testid="button-add-customer"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedCustomer && (
                <div className="bg-muted/40 rounded-md px-3 py-2 text-xs space-y-1.5">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm leading-tight">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    {selectedCustomer.company && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {selectedCustomer.company}
                      </p>
                    )}
                    {selectedCustomer.email && <p className="text-muted-foreground">{selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p className="text-muted-foreground">{selectedCustomer.phone}</p>}
                  </div>

                  {loadingCards && (
                    <div className="flex items-center gap-1.5 text-muted-foreground border-t pt-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading payment methods…</span>
                    </div>
                  )}
                  {!loadingCards && vaultedCards.length > 0 && (
                    <div className="border-t pt-1.5 space-y-0.5">
                      <p className="font-medium flex items-center gap-1 text-muted-foreground">
                        <CreditCard className="h-3 w-3" />
                        Saved cards
                      </p>
                      {vaultedCards.map((card) => (
                        <div key={card.id} className="flex items-center gap-2" data-testid={`card-row-${card.id}`}>
                          <span data-testid={`text-card-info-${card.id}`}>
                            {card.cardBrand || card.cardType || "Card"} •••• {card.last4 || card.lastFour || "****"}
                          </span>
                          {card.isDefault && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4" data-testid={`badge-default-${card.id}`}>Default</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!loadingCards && vaultedCards.length === 0 && (
                    <p className="text-muted-foreground border-t pt-1.5" data-testid="text-no-cards-message">
                      {selectedCustomer?.mxCustomerId ? "No saved payment methods" : "Not synced with payment gateway"}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Due Date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  data-testid="input-due-date"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Line Items</CardTitle>
                  {lineItems.length > 0 && (
                    <Badge variant="secondary" className="text-xs tabular-nums">{lineItems.length}</Badge>
                  )}
                </div>
                <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="flex items-center gap-3 py-5 px-2 text-muted-foreground">
                  <Package className="h-7 w-7 opacity-30 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">No items yet</p>
                    <p className="text-xs">Use "Add Item" to build the invoice</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[200px] text-xs uppercase tracking-wide text-muted-foreground">Product</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Description</TableHead>
                        <TableHead className="w-[80px] text-right text-xs uppercase tracking-wide text-muted-foreground">Qty</TableHead>
                        <TableHead className="w-[100px] text-right text-xs uppercase tracking-wide text-muted-foreground">Unit Price</TableHead>
                        <TableHead className="w-[100px] text-right text-xs uppercase tracking-wide text-muted-foreground">Discount</TableHead>
                        <TableHead className="w-[100px] text-right text-xs uppercase tracking-wide text-muted-foreground">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.id} className="h-10">
                          <TableCell className="py-1.5 font-medium text-sm">
                            <div className="flex items-center gap-1.5">
                              {item.inventoryItemId && (
                                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-muted-foreground text-xs">
                            {item.description || <span className="opacity-40">—</span>}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                              className="w-14 h-8 text-right text-sm"
                              data-testid={`input-qty-${item.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice || ""}
                              onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-20 h-8 text-right text-sm"
                              data-testid={`input-price-${item.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitDiscount || ""}
                                onChange={(e) => updateLineItem(item.id, "unitDiscount", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-20 h-8 text-right text-sm pl-5"
                                data-testid={`input-discount-${item.id}`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-semibold tabular-nums text-sm">
                            {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                              data-testid={`button-remove-${item.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</span>
              <span className="text-xs text-muted-foreground/60">(optional)</span>
            </div>
            <div className="px-4 pb-4">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note visible to the customer on the invoice..."
                className="min-h-[80px] resize-none text-sm"
                data-testid="input-notes"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attachments</span>
                <span className="text-xs text-muted-foreground/60">(optional)</span>
              </div>
              <label htmlFor="attachment-upload">
                <input
                  id="attachment-upload"
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
                  disabled={isUploading}
                  className="h-7 text-xs gap-1.5"
                  onClick={() => document.getElementById("attachment-upload")?.click()}
                  data-testid="button-upload-attachment"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Uploading..." : "Add file"}
                </Button>
              </label>
            </div>
            <div className="px-4 pb-4">
              {(() => {
                const allAttachments = isEditing
                  ? attachments
                  : stagedAttachments;
                if (allAttachments.length === 0) {
                  return <p className="text-sm text-muted-foreground">No attachments yet. Upload files for record-keeping.</p>;
                }
                return (
                  <div className="space-y-2">
                    {allAttachments.map((att) => {
                      const isImage = (att.contentType || "").startsWith("image/");
                      const sizeKB = att.fileSize ? (parseInt(att.fileSize.toString()) / 1024).toFixed(1) : null;
                      return (
                        <div
                          key={att.id}
                          className="flex items-center gap-3 p-2 rounded-md border"
                          data-testid={`attachment-item-${att.id}`}
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
                          <div className="flex items-center gap-1 shrink-0">
                            {isEditing && (
                              <a
                                href={`/api/attachments/${att.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                              >
                                <Button type="button" variant="ghost" size="icon" data-testid={`button-download-${att.id}`}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (isEditing) {
                                  deleteAttachmentMutation.mutate(att.id);
                                } else {
                                  setStagedAttachments(prev => prev.filter(a => a.id !== att.id));
                                }
                              }}
                              disabled={isEditing && deleteAttachmentMutation.isPending}
                              data-testid={`button-delete-attachment-${att.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky top-6 shadow-sm border-l-[3px] border-l-primary/40">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Invoice Summary
                </CardTitle>
                {lineItems.length > 0 && (
                  <Badge variant="secondary" className="text-xs tabular-nums">{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Subtotal / discount / tax breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {(taxRateDecimal > 0 || defaultTaxRateDecimal > 0) && (
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
                    taxAmount={taxAmount}
                    formatAmount={formatCurrency}
                    testIdPrefix="invoice-tax"
                  />
                )}
              </div>

              {/* Total row */}
              <div className={`-mx-6 px-6 py-3 border-y transition-colors ${grandTotal > 0 ? "bg-primary/5 dark:bg-primary/10" : "bg-muted/20"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Total Due</span>
                  <span className={`text-2xl font-bold tabular-nums tracking-tight transition-colors ${grandTotal > 0 ? "text-foreground" : "text-muted-foreground/50"}`} data-testid="text-grand-total">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Readiness gate */}
              {(lineItems.length === 0 || !selectedCustomerId) && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    {!selectedCustomerId && lineItems.length === 0
                      ? "Select a customer and add items to send or charge."
                      : !selectedCustomerId
                      ? "Select a customer to continue."
                      : "Add at least one line item to continue."}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {isEditing ? (
                  <>
                    <Button
                      className="w-full h-10 font-semibold"
                      onClick={() => createInvoiceMutation.mutate("save")}
                      disabled={createInvoiceMutation.isPending || lineItems.length === 0 || !selectedCustomerId}
                      data-testid="button-save-invoice"
                    >
                      {createInvoiceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                    {existingInvoice?.status !== "paid" && (
                      <div>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => createInvoiceMutation.mutate("save_and_pay")}
                          disabled={createInvoiceMutation.isPending || lineItems.length === 0 || !selectedCustomerId}
                          data-testid="button-pay-now"
                        >
                          {createInvoiceMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-2" />
                          )}
                          Pay Now
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1 ml-0.5">Collect payment immediately</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <Button
                      className="w-full h-10 font-semibold"
                      onClick={() => createInvoiceMutation.mutate("pay")}
                      disabled={createInvoiceMutation.isPending || lineItems.length === 0 || !selectedCustomerId}
                      data-testid="button-pay-now"
                    >
                      {createInvoiceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Pay Now
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1 ml-0.5">Collect payment immediately</p>
                  </div>
                )}
                <div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => createInvoiceMutation.mutate("send")}
                    disabled={createInvoiceMutation.isPending || lineItems.length === 0 || !selectedCustomerId}
                    data-testid="button-send-invoice"
                  >
                    {createInvoiceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isEditing ? "Update & Send" : "Send Invoice"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1 ml-0.5">Email a payment link to the customer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddingItem} onOpenChange={(open) => {
        setIsAddingItem(open);
        if (!open) { resetNewItem(); setInventorySearch(""); setInventorySearchOpen(false); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Add a product from inventory or create a custom item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {inventoryLiteEnabled && inventoryItems && inventoryItems.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select from Inventory</label>
                {selectedInventoryItem ? (
                  <div className="flex items-center justify-between p-2.5 border rounded-md bg-muted/30" data-testid="selected-inventory-item">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{selectedInventoryItem.name}</span>
                      <span className="text-sm text-muted-foreground">- {formatCurrency(parseFloat(selectedInventoryItem.price))}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSelectedInventoryItem(null);
                        setInventorySearch("");
                        setNewItem({ inventoryItemId: "", name: "", description: "", quantity: 1, unitPrice: 0, unitDiscount: 0, selectedSerialNumbers: [] });
                        setConfirmedModifierIds(new Set());
                        setAvailableSerials([]);
                      }}
                      data-testid="button-clear-inventory-item"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search inventory items..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        onFocus={() => setInventorySearchOpen(true)}
                        onBlur={() => setTimeout(() => setInventorySearchOpen(false), 200)}
                        className="pl-9"
                        data-testid="input-inventory-search"
                      />
                    </div>
                    {inventorySearchOpen && (() => {
                      const q = inventorySearch.toLowerCase().trim();
                      const filtered = q
                        ? inventoryItems.filter(item =>
                            item.name.toLowerCase().includes(q) ||
                            (item.sku && item.sku.toLowerCase().includes(q)) ||
                            (item.description && item.description.toLowerCase().includes(q)))
                        : inventoryItems;
                      return (
                        <div className="mt-1 max-h-48 overflow-y-auto border rounded-md">
                          {filtered.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">No items found</p>
                          ) : filtered.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors text-sm"
                              onClick={() => {
                                handleInventoryItemSelect(item.id);
                                setInventorySearch("");
                                setInventorySearchOpen(false);
                              }}
                              data-testid={`inventory-option-${item.id}`}
                            >
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{item.name}</span>
                              <span className="text-muted-foreground ml-auto shrink-0">{formatCurrency(parseFloat(item.price))}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to enter a custom item below
                </p>
                {selectedInventoryItem && (() => {
                  const itemMods = allModifiers?.filter(m => m.itemId === selectedInventoryItem.id && m.isActive) || [];
                  if (itemMods.length === 0) return null;
                  return (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPendingModifierItem(selectedInventoryItem);
                          setPendingModifierNewItem({ ...newItem });
                          const rehydrated = confirmedModifierIds.size > 0
                            ? new Set(confirmedModifierIds)
                            : new Set(itemMods.filter(m => m.isRequired).map(m => m.id));
                          setSelectedModifierIds(rehydrated);
                          setIsModifierDialogOpen(true);
                        }}
                        data-testid="button-select-addons"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {confirmedModifierIds.size > 0
                          ? `Add-Ons Selected (${confirmedModifierIds.size})`
                          : `Select Add-Ons (${itemMods.length} available)`
                        }
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}

            {inventoryLiteEnabled && inventoryItems && inventoryItems.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Item Details</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Product Name *</label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Enter product name"
                data-testid="input-item-name"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Enter description (optional)"
                data-testid="input-item-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  data-testid="input-item-quantity"
                  disabled={!!selectedInventoryItem?.trackSerialNumbers}
                />
                {selectedInventoryItem?.trackSerialNumbers && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantity is based on selected serial numbers
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Unit Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.unitPrice || ""}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="pl-7"
                    data-testid="input-item-price"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Unit Discount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.unitDiscount || ""}
                    onChange={(e) => setNewItem({ ...newItem, unitDiscount: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="pl-7"
                    data-testid="input-item-discount"
                  />
                </div>
              </div>
            </div>

            {selectedInventoryItem?.trackSerialNumbers && (
              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Select Serial Numbers *
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search serial numbers..."
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-serial-search"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {availableSerials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      No available serial numbers
                    </p>
                  ) : (
                    availableSerials
                      .filter(s => !serialSearch || s.serialNumber.toLowerCase().includes(serialSearch.toLowerCase()))
                      .map((serial) => {
                        const isSelected = newItem.selectedSerialNumbers.includes(serial.serialNumber);
                        return (
                          <div
                            key={serial.id}
                            className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-sm ${
                              isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                            }`}
                            onClick={() => toggleSerialSelection(serial.serialNumber)}
                            data-testid={`serial-${serial.serialNumber}`}
                          >
                            <span className="font-mono">{serial.serialNumber}</span>
                            <div className="flex items-center gap-2">
                              {serial.notes && <span className="text-xs text-muted-foreground">{serial.notes}</span>}
                              {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {newItem.selectedSerialNumbers.length} of {availableSerials.length} selected
                </p>
              </div>
            )}

            <div className="bg-muted/50 rounded-md p-3">
              <div className="flex justify-between text-sm">
                <span>Item Total:</span>
                <span className="font-medium">
                  {formatCurrency((newItem.unitPrice - newItem.unitDiscount) * newItem.quantity)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button onClick={addLineItem} data-testid="button-confirm-add-item">
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCustomerDialog
        open={isAddingCustomer}
        onOpenChange={setIsAddingCustomer}
        onCustomerCreated={(customer) => {
          setSelectedCustomerId(customer.id);
        }}
      />

      <Dialog open={isModifierDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPendingModifierItem(null);
          setPendingModifierNewItem(null);
          setSelectedModifierIds(new Set());
        }
        setIsModifierDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Add-Ons</DialogTitle>
            <DialogDescription>
              Choose modifiers for {pendingModifierItem?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingModifierItem && (allModifiers?.filter(m => m.itemId === pendingModifierItem.id && m.isActive) || []).map((mod) => (
              <div key={mod.id} className="flex items-center gap-3 p-3 rounded-md border">
                <Checkbox
                  id={`inv-mod-${mod.id}`}
                  checked={selectedModifierIds.has(mod.id)}
                  disabled={mod.isRequired}
                  onCheckedChange={(checked) => {
                    setSelectedModifierIds(prev => {
                      const next = new Set(prev);
                      if (checked) next.add(mod.id);
                      else next.delete(mod.id);
                      return next;
                    });
                  }}
                  data-testid={`checkbox-invoice-modifier-${mod.id}`}
                />
                <label htmlFor={`inv-mod-${mod.id}`} className="flex-1 cursor-pointer">
                  <span className="font-medium text-sm">{mod.name}</span>
                  {mod.isRequired && <Badge variant="secondary" className="ml-2">Required</Badge>}
                </label>
                <span className="text-sm font-medium">
                  +{formatCurrency(parseFloat(mod.price || "0"))}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModifierDialogOpen(false); setPendingModifierItem(null); setPendingModifierNewItem(null); }}>
              Cancel
            </Button>
            <Button onClick={confirmInvoiceModifiers} data-testid="button-confirm-invoice-modifiers">
              Confirm Add-Ons
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayNowOpen} onOpenChange={setIsPayNowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              Enter payment details to process payment of {formatCurrency(grandTotal)}
            </DialogDescription>
          </DialogHeader>
          {loadingCards ? (
            <div className="flex items-center justify-center p-8" data-testid="loading-payment-methods">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading payment methods...</span>
            </div>
          ) : (
            <PaymentForm
              amount={grandTotal}
              onSubmit={(data) => payNowMutation.mutate(data)}
              isPending={payNowMutation.isPending}
              onCancel={() => setIsPayNowOpen(false)}
              vaultedCards={vaultedCards}
              vaultedBanks={vaultedBanks}
              customerName={selectedCustomer ? `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim() : ""}
              tenderSettings={tenderSettings}
              adjustmentSettings={invoiceAdjSettings}
              terminals={terminals || []}
              customerId={selectedCustomerId}
              invoiceId={savedInvoiceIdRef.current || invoiceId || undefined}
              onTerminalSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
                const targetInvoiceId = savedInvoiceIdRef.current || invoiceId;
                if (targetInvoiceId) {
                  apiRequest("POST", `/api/invoices/${targetInvoiceId}/mark-paid`, {
                    paidAmount: grandTotal.toFixed(2)
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
                  }).catch(() => {});
                }
                toast({
                  title: "Payment processed",
                  description: "The invoice has been paid successfully via terminal."
                });
                setIsPayNowOpen(false);
                setLocation("/transactions");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentForm({
  amount,
  onSubmit,
  isPending,
  onCancel,
  vaultedCards = [],
  vaultedBanks = [],
  customerName = "",
  tenderSettings,
  adjustmentSettings = null,
  terminals = [],
  customerId,
  invoiceId,
  onTerminalSuccess
}: {
  amount: number;
  onSubmit: (data: any) => void;
  isPending: boolean;
  onCancel: () => void;
  vaultedCards?: VaultedCard[];
  vaultedBanks?: VaultedBank[];
  customerName?: string;
  tenderSettings?: any;
  adjustmentSettings?: any;
  terminals?: any[];
  customerId?: string;
  invoiceId?: string;
  onTerminalSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<"saved" | "new_card" | "ach" | "saved_bank" | "terminal" | "cash" | "check">(vaultedCards.length > 0 ? "saved" : "new_card");
  const [checkNumber, setCheckNumber] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(vaultedCards.length > 0 ? vaultedCards[0]?.id || "" : "");
  const [selectedBankId, setSelectedBankId] = useState(vaultedBanks.length > 0 ? vaultedBanks[0]?.id || "" : "");
  const [cardEntry, setCardEntry] = useState<CardEntryValues>({
    ...emptyCardEntryValues,
    cardholderName: customerName || "",
  });
  const [achEntry, setAchEntry] = useState<AchEntryValues>({
    ...emptyAchEntryValues,
    accountHolderName: customerName || "",
  });

  const [selectedTerminalId, setSelectedTerminalId] = useState(terminals.length > 0 ? terminals[0]?.id || "" : "");
  const [terminalTxStatus, setTerminalTxStatus] = useState<"idle" | "sending" | "waiting" | "polling" | "completed" | "approved" | "failed" | "cancelled">("idle");
  const [terminalTxResult, setTerminalTxResult] = useState<any>(null);
  const [terminalTxError, setTerminalTxError] = useState<string | null>(null);
  const [terminalAuditId, setTerminalAuditId] = useState<string | null>(null);
  const [terminalTxAmount, setTerminalTxAmount] = useState<number | null>(null);

  const isTerminalEnabled = (!tenderSettings || tenderSettings.terminalInvoice !== false) && terminals.length > 0;

  useEffect(() => {
    if (vaultedCards.length > 0) {
      setPaymentMethod("saved");
      setSelectedCardId(vaultedCards[0]?.id || "");
    } else {
      setPaymentMethod("new_card");
      setSelectedCardId("");
    }
  }, [vaultedCards]);

  useEffect(() => {
    if (vaultedBanks.length > 0) {
      setSelectedBankId(vaultedBanks[0]?.id || "");
    }
  }, [vaultedBanks]);

  useEffect(() => {
    if (customerName) {
      setCardEntry(prev => ({ ...prev, cardholderName: customerName }));
      setAchEntry(prev => ({ ...prev, accountHolderName: customerName }));
    }
  }, [customerName]);

  useEffect(() => {
    if (terminals.length > 0 && !selectedTerminalId) {
      setSelectedTerminalId(terminals[0]?.id || "");
    }
  }, [terminals]);

  useEffect(() => {
    if (tenderSettings) {
      const isCardEnabled = tenderSettings.cardInvoice !== false;
      const isAchEnabled = tenderSettings.achInvoice !== false;
      const isCashEnabled = tenderSettings.cashInvoice !== false;
      const isCheckEnabled = tenderSettings.checkInvoice !== false;
      const findFirstEnabled = () => {
        if (isCardEnabled) return vaultedCards.length > 0 ? "saved" : "new_card";
        if (isAchEnabled) return "ach";
        if (isCashEnabled) return "cash";
        if (isCheckEnabled) return "check";
        if (isTerminalEnabled) return "terminal";
        return "new_card";
      };
      if ((paymentMethod === "saved" || paymentMethod === "new_card") && !isCardEnabled) {
        setPaymentMethod(findFirstEnabled() as any);
      }
      if ((paymentMethod === "ach" || paymentMethod === "saved_bank") && !isAchEnabled) {
        setPaymentMethod(findFirstEnabled() as any);
      }
      if (paymentMethod === "cash" && !isCashEnabled) {
        setPaymentMethod(findFirstEnabled() as any);
      }
      if (paymentMethod === "check" && !isCheckEnabled) {
        setPaymentMethod(findFirstEnabled() as any);
      }
      if (paymentMethod === "terminal" && !isTerminalEnabled) {
        setPaymentMethod(findFirstEnabled() as any);
      }
    }
  }, [tenderSettings, isTerminalEnabled]);

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
        setTerminalTxError("Transaction timed out waiting for terminal response.");
        return;
      }
      attempts++;
      try {
        const params = new URLSearchParams({ terminalId: termId });
        if (auditId) params.set("devicePaymentAuditId", auditId);
        if (txAmount) params.set("amount", String(txAmount));
        const res = await fetch(`/api/terminal-transactions/poll?${params.toString()}`, { credentials: "include" });
        if (!res.ok) { setTimeout(poll, pollInterval); return; }
        const data = await res.json();
        const status = (data.status || "").toString().toLowerCase();

        if (status === "pending") { setTimeout(poll, pollInterval); return; }

        const isApproved = status === "approved" || status === "captured" || status === "settled" || status === "success"
          || (data.authCode && !["declined", "error", "voided", "failed"].includes(status));
        const isDeclined = status === "declined" || status === "error" || status === "voided" || status === "failed";

        if (isApproved) {
          setTerminalTxResult(data);
          setTerminalTxStatus("approved");
          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          toast({ title: "Terminal Payment Approved", description: `Payment of ${formatCurrency(txAmount)} processed via terminal.` });
          if (onTerminalSuccess) onTerminalSuccess();
        } else if (isDeclined) {
          setTerminalTxResult(data);
          setTerminalTxStatus("failed");
          setTerminalTxError(data.authMessage || data.responseMessage || data.message || `Transaction ${status}`);
          toast({ title: "Terminal Payment Failed", description: data.authMessage || data.responseMessage || data.message || `Transaction was ${status}`, variant: "destructive" });
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
    if (!selectedTerminalId) {
      toast({ title: "Terminal required", description: "Please select a terminal device.", variant: "destructive" });
      return;
    }

    setTerminalTxStatus("sending");
    setTerminalTxError(null);
    setTerminalTxResult(null);

    const terminalPricing = adjustmentSettings ? calculateTenderAdjustment({ baseAmount: amount, tax: 0, tenderType: "terminal", adjustmentSettings }) : null;
    const terminalChargeAmount = terminalPricing ? terminalPricing.total : amount;

    try {
      const res = await apiRequest("POST", "/api/terminal-transactions", {
        terminalId: selectedTerminalId,
        amount: terminalChargeAmount,
        type: "Sale",
        vaultCard: false,
        customerId: customerId || null,
      });
      const data = await res.json();

      if (data.completed && data.approved) {
        setTerminalTxStatus("approved");
        setTerminalTxResult(data);
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        toast({ title: "Payment Approved", description: `Transaction approved. Auth: ${data.authCode || "N/A"}` });
        if (onTerminalSuccess) onTerminalSuccess();
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
        setTerminalTxAmount(amount);
        setTerminalTxStatus("waiting");
        toast({ title: "Sent to Terminal", description: "Transaction sent to the terminal. Waiting for customer..." });
        pollTerminalTransaction(auditId, amount, selectedTerminalId);
      } else if (data.success) {
        setTerminalTxAmount(amount);
        setTerminalTxStatus("waiting");
        toast({ title: "Sent to Terminal", description: "Transaction sent to the terminal. Waiting for customer..." });
        pollTerminalTransaction("", amount, selectedTerminalId);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "terminal") {
      sendToTerminal();
      return;
    }
    if (paymentMethod === "cash") {
      onSubmit({ tenderType: "Cash" });
      return;
    }
    if (paymentMethod === "check") {
      onSubmit({ tenderType: "Check", checkNumber: checkNumber || null });
      return;
    }
    if (paymentMethod === "saved_bank" && selectedBankId) {
      onSubmit({
        tenderType: "ACH",
        savedBankAccountId: selectedBankId,
      });
    } else if (paymentMethod === "ach") {
      onSubmit({
        tenderType: "ACH",
        bankAccountNumber: achEntry.accountNumber,
        bankRoutingNumber: achEntry.routingNumber,
        bankAccountType: achEntry.accountType,
        bankAccountHolderName: achEntry.accountHolderName,
        achEntryClass: "WEB",
      });
    } else if (paymentMethod === "saved" && selectedCardId) {
      const selectedCard = vaultedCards.find(c => c.id === selectedCardId);
      onSubmit({
        tenderType: "Card",
        cardAccountId: selectedCardId,
        cardToken: selectedCard?.token || selectedCard?.cardId,
        expiryMonth: selectedCard?.expiryMonth || selectedCard?.expMonth,
        expiryYear: selectedCard?.expiryYear || selectedCard?.expYear,
        cardholderName: selectedCard?.name || selectedCard?.cardholderName,
        avsStreet: selectedCard?.avsStreet,
        avsZip: selectedCard?.avsZip
      });
    } else {
      onSubmit({
        tenderType: "Card",
        cardNumber: cardEntry.cardNumber,
        expiryMonth: cardEntry.expiryMonth,
        expiryYear: cardEntry.expiryYear,
        cvv: cardEntry.cvv,
        customerName: cardEntry.cardholderName,
        avsZip: cardEntry.avsZip.trim() || undefined,
        avsStreet: cardEntry.avsStreet.trim() || undefined,
      });
    }
  };

  const isTerminalBusy = paymentMethod === "terminal" && terminalTxStatus !== "idle";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <label className="text-sm font-medium">Payment Method</label>
        <div className="flex gap-2 flex-wrap">
          {(!tenderSettings || tenderSettings.cardInvoice) && vaultedCards.length > 0 && (
            <Button
              type="button"
              variant={paymentMethod === "saved" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("saved")}
              disabled={isTerminalBusy}
              data-testid="button-use-saved-card"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Saved Card
            </Button>
          )}
          {(!tenderSettings || tenderSettings.cardInvoice) && (
            <Button
              type="button"
              variant={paymentMethod === "new_card" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("new_card")}
              disabled={isTerminalBusy}
              data-testid="button-use-new-card"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Card
            </Button>
          )}
          {(!tenderSettings || tenderSettings.achInvoice) && vaultedBanks.length > 0 && (
            <Button
              type="button"
              variant={paymentMethod === "saved_bank" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("saved_bank")}
              disabled={isTerminalBusy}
              data-testid="button-use-saved-bank"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Saved Bank
            </Button>
          )}
          {(!tenderSettings || tenderSettings.achInvoice) && (
            <Button
              type="button"
              variant={paymentMethod === "ach" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("ach")}
              disabled={isTerminalBusy}
              data-testid="button-use-ach"
            >
              <Building2 className="h-4 w-4 mr-2" />
              ACH
            </Button>
          )}
          {isTerminalEnabled && (
            <Button
              type="button"
              variant={paymentMethod === "terminal" ? "default" : "outline"}
              size="sm"
              onClick={() => { setPaymentMethod("terminal"); resetTerminalState(); }}
              disabled={isTerminalBusy}
              data-testid="button-use-terminal"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Terminal
            </Button>
          )}
          {(!tenderSettings || tenderSettings.cashInvoice) && (
            <Button
              type="button"
              variant={paymentMethod === "cash" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("cash")}
              disabled={isTerminalBusy}
              data-testid="button-use-cash"
            >
              <Banknote className="h-4 w-4 mr-2" />
              Cash
            </Button>
          )}
          {(!tenderSettings || tenderSettings.checkInvoice) && (
            <Button
              type="button"
              variant={paymentMethod === "check" ? "default" : "outline"}
              size="sm"
              onClick={() => setPaymentMethod("check")}
              disabled={isTerminalBusy}
              data-testid="button-use-check"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Check
            </Button>
          )}
        </div>
      </div>

      {paymentMethod === "terminal" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Terminal Device</label>
            <Select value={selectedTerminalId} onValueChange={(val) => { setSelectedTerminalId(val); resetTerminalState(); }}>
              <SelectTrigger data-testid="select-terminal">
                <SelectValue placeholder="Select a terminal" />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span>{t.name || t.terminalName || `Terminal ${t.mxTerminalId || t.id.slice(0, 8)}`}</span>
                      {t.model && <span className="text-muted-foreground text-xs">({t.model})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {terminalTxStatus === "idle" && (
            <Button
              type="button"
              className="w-full"
              onClick={sendToTerminal}
              disabled={!selectedTerminalId}
              data-testid="button-send-to-terminal"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Send {formatCurrency(amount)} to Terminal
            </Button>
          )}

          {terminalTxStatus === "sending" && (
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
                    {terminalTxResult.amount && <p>Amount: {formatCurrency(parseFloat(terminalTxResult.amount))}</p>}
                  </div>
                )}
              </div>
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
                Try Again
              </Button>
            </div>
          )}
        </div>
      )}

      {paymentMethod === "cash" && (
        <div className="p-4 rounded-md border bg-muted/30 text-sm space-y-2" data-testid="cash-payment-info">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Cash Payment</span>
          </div>
          <p className="text-muted-foreground">
            Record a cash payment of {formatCurrency(amount)}.
          </p>
        </div>
      )}

      {paymentMethod === "check" && (
        <div className="space-y-3" data-testid="check-payment-form">
          <div className="flex items-center gap-2 text-sm">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Check Payment</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="check-number">Check Number</label>
            <Input
              id="check-number"
              placeholder="Enter check number"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              data-testid="input-check-number"
            />
          </div>
        </div>
      )}

      {paymentMethod === "saved_bank" && vaultedBanks.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Bank Account</label>
          <div className="space-y-2">
            {vaultedBanks.map((bank) => (
              <div
                key={bank.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  selectedBankId === bank.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedBankId(bank.id)}
                data-testid={`bank-option-${bank.id}`}
              >
                <input
                  type="radio"
                  name="savedBank"
                  checked={selectedBankId === bank.id}
                  onChange={() => setSelectedBankId(bank.id)}
                  className="h-4 w-4"
                />
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {bank.bankName || "Bank"} •••• {bank.last4 || "****"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bank.accountType || "Account"} {bank.accountHolderName && `• ${bank.accountHolderName}`}
                  </p>
                </div>
                {bank.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentMethod === "saved" && vaultedCards.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Select Card</label>
          <div className="space-y-2">
            {vaultedCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  selectedCardId === card.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedCardId(card.id)}
                data-testid={`card-option-${card.id}`}
              >
                <input
                  type="radio"
                  name="savedCard"
                  checked={selectedCardId === card.id}
                  onChange={() => setSelectedCardId(card.id)}
                  className="h-4 w-4"
                />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {card.cardBrand || card.cardType || "Card"} •••• {card.last4 || card.lastFour || "****"}
                  </p>
                  {card.expiryMonth && card.expiryYear && (
                    <p className="text-xs text-muted-foreground">
                      Expires {card.expiryMonth}/{card.expiryYear}
                    </p>
                  )}
                </div>
                {card.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {paymentMethod === "new_card" && (
        <CardEntryForm
          values={cardEntry}
          onChange={setCardEntry}
          idPrefix="inv"
        />
      )}

      {paymentMethod === "ach" && (
        <AchEntryForm
          values={achEntry}
          onChange={setAchEntry}
          idPrefix="inv"
        />
      )}

      {(() => {
        const tenderForAdj = (paymentMethod === "ach" || paymentMethod === "saved_bank") ? "ach" : (paymentMethod === "cash" || paymentMethod === "check") ? "cash" : (paymentMethod === "terminal") ? "terminal" : "card";
        const invPricing = adjustmentSettings ? calculateTenderAdjustment({ baseAmount: amount, tax: 0, tenderType: tenderForAdj, adjustmentSettings }) : null;
        const showAdj = invPricing && invPricing.adjustmentAmount > 0;
        const displayTotal = showAdj ? invPricing.total : amount;
        return (
          <>
            {showAdj && (
              <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400 px-1">
                <span>{invPricing.adjustmentLabel}</span>
                <span>+{formatCurrency(invPricing.adjustmentAmount)}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-process-payment">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {paymentMethod === "cash" ? (
                      <Banknote className="h-4 w-4 mr-2" />
                    ) : paymentMethod === "check" ? (
                      <Receipt className="h-4 w-4 mr-2" />
                    ) : paymentMethod === "ach" || paymentMethod === "saved_bank" ? (
                      <Building2 className="h-4 w-4 mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    {paymentMethod === "cash" ? `Record Cash ${formatCurrency(amount)}` :
                     paymentMethod === "check" ? `Record Check ${formatCurrency(amount)}` :
                     `Pay ${formatCurrency(displayTotal)}`}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        );
      })()}

      {paymentMethod === "terminal" && terminalTxStatus === "idle" && (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      )}
    </form>
  );
}
