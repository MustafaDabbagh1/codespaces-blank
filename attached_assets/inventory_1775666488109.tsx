import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MerchantLayout from "@/components/merchant-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { INVENTORY_UNIT_STATUS, INVENTORY_UNIT_SOURCE } from "@shared/schema";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Search, Package, Tag, AlertTriangle, Loader2, Edit, ArrowUpDown, Cpu, Truck, FolderOpen, Pencil, ArrowRightLeft, Check, ChevronsUpDown, X } from "lucide-react";
import { useStoreContext } from "@/contexts/store-context";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "in_stock": return "default";
    case "sold": return "secondary";
    case "damaged": return "destructive";
    default: return "outline";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function conditionLabel(condition: string): string {
  return condition.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function sourceLabel(source: string): string {
  return source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function InventoryPage() {
  const { toast } = useToast();
  const { selectedStoreId, isMultiStore } = useStoreContext();
  const [activeTab, setActiveTab] = useState("products");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSerializedToggle, setIsSerializedToggle] = useState(false);

  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState<string>("all");
  const [unitProductFilter, setUnitProductFilter] = useState<string>("all");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveProductId, setReceiveProductId] = useState<string>("");
  const [receiveProductPopoverOpen, setReceiveProductPopoverOpen] = useState(false);
  const productComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!receiveProductPopoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (productComboRef.current && !productComboRef.current.contains(e.target as Node)) {
        setReceiveProductPopoverOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReceiveProductPopoverOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [receiveProductPopoverOpen]);

  const [vendorCreateOpen, setVendorCreateOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);

  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [quickAddCategoryOpen, setQuickAddCategoryOpen] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromStore, setTransferFromStore] = useState<string>("");
  const [transferToStore, setTransferToStore] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState("");
  const [selectedTransferUnits, setSelectedTransferUnits] = useState<number[]>([]);
  const [transferUnitSearch, setTransferUnitSearch] = useState("");

  const [stdTransferOpen, setStdTransferOpen] = useState(false);
  const [stdTransferFromStore, setStdTransferFromStore] = useState<string>("");
  const [stdTransferToStore, setStdTransferToStore] = useState<string>("");
  const [stdTransferProductId, setStdTransferProductId] = useState<string>("");
  const [stdTransferQty, setStdTransferQty] = useState("");
  const [stdTransferNotes, setStdTransferNotes] = useState("");
  const [adjustStoreId, setAdjustStoreId] = useState<string>("");

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/products", "withStoreStock"],
    queryFn: async () => {
      const res = await fetch("/api/merchant/products?includeStoreStock=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/categories"] });
  const { data: settingsData } = useQuery<any>({ queryKey: ["/api/merchant/settings"] });
  const { data: stores = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/stores"] });
  const { data: vendors = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/vendors"] });
  const { data: inventoryUnits = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/inventory-units", unitStatusFilter, unitProductFilter, unitSearch, selectedStoreId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unitStatusFilter !== "all") params.set("status", unitStatusFilter);
      if (unitProductFilter !== "all") params.set("productId", unitProductFilter);
      if (unitSearch) params.set("search", unitSearch);
      if (selectedStoreId) params.set("storeId", String(selectedStoreId));
      const res = await fetch(`/api/merchant/inventory-units?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory units");
      return res.json();
    },
  });

  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/inventory-transfers"],
  });

  const { data: allUnitsForTransfer = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/inventory-units", "transfer", transferFromStore],
    queryFn: async () => {
      if (!transferFromStore) return [];
      const params = new URLSearchParams({ storeId: transferFromStore, status: "in_stock" });
      const res = await fetch(`/api/merchant/inventory-units?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: !!transferFromStore,
  });

  const availableUnitsForTransfer = allUnitsForTransfer.filter((u: any) =>
    !transferUnitSearch ||
    u.serialNumber?.toLowerCase().includes(transferUnitSearch.toLowerCase()) ||
    u.imei?.toLowerCase().includes(transferUnitSearch.toLowerCase())
  );

  const serializedProducts = products.filter((p: any) => p.isSerialized);
  const dualPricingEnabled = settingsData?.settings?.dualPricingEnabled;
  const uplift = parseFloat(settingsData?.settings?.cardUpliftPercent || "3.50");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editProduct ? `/api/merchant/products/${editProduct.id}` : "/api/merchant/products";
      const method = editProduct ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      setCreateOpen(false);
      setEditProduct(null);
      setIsSerializedToggle(false);
      toast({ title: editProduct ? "Product updated" : "Product created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        productId: adjustProduct.id,
        quantityDelta: parseInt(adjustQty),
        reason: adjustReason,
      };
      if (adjustStoreId) payload.storeId = parseInt(adjustStoreId);
      const res = await apiRequest("POST", "/api/merchant/inventory/adjust", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustReason("");
      setAdjustStoreId("");
      toast({ title: "Stock adjusted" });
    },
  });

  const receiveUnitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/merchant/inventory-units", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      setReceiveOpen(false);
      setReceiveProductId("");
      toast({ title: "Serialized unit received" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const vendorMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editVendor ? `/api/merchant/vendors/${editVendor.id}` : "/api/merchant/vendors";
      const method = editVendor ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/vendors"] });
      setVendorCreateOpen(false);
      setEditVendor(null);
      toast({ title: editVendor ? "Vendor updated" : "Vendor created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const categoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editCategory ? `/api/merchant/categories/${editCategory.id}` : "/api/merchant/categories";
      const method = editCategory ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/categories"] });
      setCategoryCreateOpen(false);
      setQuickAddCategoryOpen(false);
      setEditCategory(null);
      toast({ title: editCategory ? "Category updated" : "Category created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTransferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/merchant/inventory-transfers", {
        fromStoreId: parseInt(transferFromStore),
        toStoreId: parseInt(transferToStore),
        unitIds: selectedTransferUnits,
        notes: transferNotes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-units"] });
      setTransferOpen(false);
      setTransferFromStore("");
      setTransferToStore("");
      setTransferNotes("");
      setSelectedTransferUnits([]);
      setTransferUnitSearch("");
      toast({ title: "Transfer created successfully" });
    },
    onError: (err: any) => toast({ title: "Transfer failed", description: err.message, variant: "destructive" }),
  });

  const completeTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/merchant/inventory-transfers/${id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-units"] });
      toast({ title: "Transfer completed — units moved to destination store" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/merchant/inventory-transfers/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-units"] });
      toast({ title: "Transfer cancelled — units returned to source store" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createStdTransferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/merchant/inventory-transfers/standard", {
        fromStoreId: parseInt(stdTransferFromStore),
        toStoreId: parseInt(stdTransferToStore),
        productId: parseInt(stdTransferProductId),
        quantity: parseInt(stdTransferQty),
        notes: stdTransferNotes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/store-inventory"] });
      setStdTransferOpen(false);
      setStdTransferFromStore("");
      setStdTransferToStore("");
      setStdTransferProductId("");
      setStdTransferQty("");
      setStdTransferNotes("");
      toast({ title: "Standard transfer created successfully" });
    },
    onError: (err: any) => toast({ title: "Transfer failed", description: err.message, variant: "destructive" }),
  });

  const handleCategorySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      name: fd.get("name"),
      description: fd.get("description") || null,
      parentId: fd.get("parentId") === "none" ? null : fd.get("parentId") || null,
    };
    if (!editCategory) {
      payload.isActive = true;
    }
    categoryMutation.mutate(payload);
  };

  const topLevelCategories = categories.filter((c: any) => !c.parentId);
  const getSubcategories = (parentId: number) => categories.filter((c: any) => c.parentId === parentId);

  const filtered = products.filter((p: any) => {
    if (categoryFilter !== "all") {
      const filterId = parseInt(categoryFilter);
      const childIds = getSubcategories(filterId).map((c: any) => c.id);
      if (p.categoryId !== filterId && !childIds.includes(p.categoryId)) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
    }
    return true;
  });

  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionType, setCommissionType] = useState("none");
  const [isOpenPrice, setIsOpenPrice] = useState(false);
  const [costCalcMode, setCostCalcMode] = useState("fixed_cost");
  const [previewAmount, setPreviewAmount] = useState("100.00");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isSerialized = isSerializedToggle;
    const payload: any = {
      name: fd.get("name"),
      sku: fd.get("sku") || null,
      barcode: fd.get("barcode") || null,
      description: fd.get("description") || null,
      categoryId: fd.get("categoryId") ? parseInt(fd.get("categoryId") as string) : null,
      isService: fd.get("isService") === "on",
      isSerialized,
      trackInventory: fd.get("trackInventory") === "on",
      quantityOnHand: isSerialized ? 0 : (parseInt(fd.get("quantityOnHand") as string) || 0),
      lowStockThreshold: isSerialized ? 0 : (parseInt(fd.get("lowStockThreshold") as string) || 5),
      taxable: fd.get("taxable") === "on",
      isActive: true,
      commissionEnabled,
      commissionType: commissionEnabled ? commissionType : "none",
      commissionValue: commissionEnabled ? (fd.get("commissionValue") || "0") : "0",
      isOpenPrice,
      costCalculationMode: isOpenPrice ? costCalcMode : "fixed_cost",
    };
    if (isOpenPrice) {
      payload.cashPrice = null;
      payload.cost = null;
      if (costCalcMode === "fixed_cost") payload.fixedCost = fd.get("fixedCost") || null;
      if (costCalcMode === "profit_percent_of_sale") payload.profitPercent = fd.get("profitPercent") || null;
      if (costCalcMode === "flat_profit") payload.flatProfitAmount = fd.get("flatProfitAmount") || null;
      payload.minOpenPrice = fd.get("minOpenPrice") || null;
      payload.maxOpenPrice = fd.get("maxOpenPrice") || null;
    } else {
      payload.cost = fd.get("cost") || null;
      payload.cashPrice = fd.get("cashPrice");
    }
    createMutation.mutate(payload);
  };

  const handleReceiveSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const vendorIdVal = fd.get("vendorId") as string;
    const unitCommType = fd.get("unitCommissionType") as string;
    const unitCommVal = fd.get("unitCommissionValue") as string;
    if (!receiveProductId) {
      toast({ title: "Product required", description: "Please select a serialized product.", variant: "destructive" });
      return;
    }
    receiveUnitMutation.mutate({
      productId: parseInt(receiveProductId),
      storeId: fd.get("storeId") ? parseInt(fd.get("storeId") as string) : null,
      serialNumber: fd.get("serialNumber") || undefined,
      imei: fd.get("imei") || undefined,
      condition: fd.get("condition") || "new",
      sourceType: fd.get("sourceType") || "manual",
      vendorId: vendorIdVal ? parseInt(vendorIdVal) : null,
      acquisitionCost: fd.get("acquisitionCost") || "0.00",
      notes: fd.get("notes") || undefined,
      ...(unitCommType ? { commissionType: unitCommType } : {}),
      ...(unitCommVal ? { commissionValue: unitCommVal } : {}),
    });
  };

  const handleVendorSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    vendorMutation.mutate({
      name: fd.get("name"),
      contactName: fd.get("contactName") || undefined,
      email: fd.get("email") || undefined,
      phone: fd.get("phone") || undefined,
      notes: fd.get("notes") || undefined,
    });
  };

  const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
  const storeMap = Object.fromEntries(stores.map((s: any) => [s.id, s]));

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-inventory-title">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">{products.length} products & services</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-inventory">
            <TabsTrigger value="products" data-testid="tab-products"><Package className="w-4 h-4 mr-1.5" /> Products</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories"><FolderOpen className="w-4 h-4 mr-1.5" /> Categories</TabsTrigger>
            <TabsTrigger value="serialized" data-testid="tab-serialized"><Cpu className="w-4 h-4 mr-1.5" /> Serialized Units</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors"><Truck className="w-4 h-4 mr-1.5" /> Vendors</TabsTrigger>
            {stores.length > 1 && (
              <TabsTrigger value="transfers" data-testid="tab-transfers"><ArrowRightLeft className="w-4 h-4 mr-1.5" /> Transfers</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-products" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {topLevelCategories.map((c: any) => {
                      const subs = getSubcategories(c.id);
                      return [
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>,
                        ...subs.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>&nbsp;&nbsp;└ {s.name}</SelectItem>)
                      ];
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={createOpen || !!editProduct} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditProduct(null); setIsSerializedToggle(false); setCommissionEnabled(false); setCommissionType("none"); setIsOpenPrice(false); setCostCalcMode("fixed_cost"); } else { setCreateOpen(true); } }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-product"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2"><Label>Name *</Label><Input name="name" required defaultValue={editProduct?.name} data-testid="input-product-name" /></div>
                      <div><Label>SKU</Label><Input name="sku" defaultValue={editProduct?.sku} /></div>
                      <div><Label>Barcode</Label><Input name="barcode" defaultValue={editProduct?.barcode} /></div>
                      <div>
                        <Label>Category</Label>
                        <div className="flex gap-1.5">
                          <Select name="categoryId" defaultValue={editProduct?.categoryId?.toString()}>
                            <SelectTrigger data-testid="select-product-category"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {topLevelCategories.map((c: any) => {
                                const subs = getSubcategories(c.id);
                                return [
                                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>,
                                  ...subs.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>&nbsp;&nbsp;└ {s.name}</SelectItem>)
                                ];
                              })}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setQuickAddCategoryOpen(true)} title="Add new category" data-testid="button-quick-add-category">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {!isOpenPrice && (
                        <>
                          <div><Label>Cost ($)</Label><Input name="cost" type="number" step="0.01" defaultValue={editProduct?.cost} /></div>
                          <div>
                            <Label>Cash Price ($) *</Label>
                            <Input name="cashPrice" type="number" step="0.01" required defaultValue={editProduct?.cashPrice} data-testid="input-cash-price" />
                          </div>
                          <div>
                            <Label>Card Price (preview)</Label>
                            <div className="text-sm font-medium text-muted-foreground mt-2">
                              {dualPricingEnabled ? `+${uplift}% uplift` : "Dual pricing off"}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div><Label>Description</Label><Textarea name="description" defaultValue={editProduct?.description} /></div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="isOpenPrice"
                          checked={isOpenPrice}
                          onCheckedChange={setIsOpenPrice}
                          data-testid="switch-open-price"
                        />
                        <Label htmlFor="isOpenPrice">Open Price (cashier enters amount at sale)</Label>
                      </div>
                    </div>

                    {isOpenPrice && (
                      <div className="border rounded-lg p-3 space-y-3">
                        <div>
                          <Label>Cost Calculation Mode</Label>
                          <Select value={costCalcMode} onValueChange={setCostCalcMode}>
                            <SelectTrigger data-testid="select-cost-calc-mode"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed_cost">Fixed Cost</SelectItem>
                              <SelectItem value="profit_percent_of_sale">% of Sale Price</SelectItem>
                              <SelectItem value="flat_profit">Flat Profit Amount</SelectItem>
                              <SelectItem value="manual_cost_at_sale">Manual Cost at Sale</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {costCalcMode === "fixed_cost" && (
                          <div><Label>Fixed Cost ($)</Label><Input name="fixedCost" type="number" step="0.01" defaultValue={editProduct?.fixedCost} data-testid="input-fixed-cost" /></div>
                        )}
                        {costCalcMode === "profit_percent_of_sale" && (
                          <div>
                            <Label>Profit Percent (%)</Label>
                            <Input name="profitPercent" type="number" step="0.01" min="0" max="100" defaultValue={editProduct?.profitPercent} data-testid="input-profit-percent" />
                            <p className="text-xs text-muted-foreground mt-1">Profit = sale amount × percent. Cost = sale amount − profit.</p>
                          </div>
                        )}
                        {costCalcMode === "flat_profit" && (
                          <div><Label>Flat Profit ($)</Label><Input name="flatProfitAmount" type="number" step="0.01" min="0" defaultValue={editProduct?.flatProfitAmount} data-testid="input-flat-profit" /></div>
                        )}
                        {costCalcMode === "manual_cost_at_sale" && (
                          <p className="text-xs text-muted-foreground">Cashier will enter cost at time of sale.</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Min Price ($)</Label><Input name="minOpenPrice" type="number" step="0.01" min="0" defaultValue={editProduct?.minOpenPrice} data-testid="input-min-open-price" /></div>
                          <div><Label>Max Price ($)</Label><Input name="maxOpenPrice" type="number" step="0.01" min="0" defaultValue={editProduct?.maxOpenPrice} data-testid="input-max-open-price" /></div>
                        </div>
                        {costCalcMode !== "manual_cost_at_sale" && (
                          <div className="bg-muted/50 rounded p-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Preview: If sold for $</Label>
                              <Input className="w-24 h-7 text-xs" type="number" step="0.01" value={previewAmount} onChange={(e) => setPreviewAmount(e.target.value)} />
                            </div>
                            {(() => {
                              const amt = parseFloat(previewAmount) || 0;
                              let cost = 0, profit = 0;
                              if (costCalcMode === "fixed_cost") {
                                const fc = parseFloat((document.querySelector('[name="fixedCost"]') as HTMLInputElement)?.value || "0");
                                cost = fc; profit = amt - fc;
                              } else if (costCalcMode === "profit_percent_of_sale") {
                                const pct = parseFloat((document.querySelector('[name="profitPercent"]') as HTMLInputElement)?.value || "0");
                                profit = Math.round(amt * pct / 100 * 100) / 100; cost = amt - profit;
                              } else if (costCalcMode === "flat_profit") {
                                const fp = parseFloat((document.querySelector('[name="flatProfitAmount"]') as HTMLInputElement)?.value || "0");
                                profit = fp; cost = amt - fp;
                              }
                              return (
                                <p className="text-xs font-medium">
                                  → Cost: ${Math.max(0, cost).toFixed(2)}, Profit: ${Math.max(0, profit).toFixed(2)}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="isSerialized"
                          checked={isSerializedToggle}
                          onCheckedChange={setIsSerializedToggle}
                          data-testid="switch-is-serialized"
                        />
                        <Label htmlFor="isSerialized">Serialized Item (track by serial/IMEI)</Label>
                      </div>
                    </div>

                    {!isSerializedToggle && !isOpenPrice && (
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Stock Qty</Label><Input name="quantityOnHand" type="number" defaultValue={editProduct?.quantityOnHand ?? 0} /></div>
                        <div><Label>Low Stock At</Label><Input name="lowStockThreshold" type="number" defaultValue={editProduct?.lowStockThreshold ?? 5} /></div>
                      </div>
                    )}

                    {isSerializedToggle && (
                      <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted/50">
                        Stock is tracked per-unit via serialized inventory. Add units from the "Serialized Units" tab after creating this product.
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-3"><Switch name="isService" id="isService" defaultChecked={editProduct?.isService} /><Label htmlFor="isService">Service Item</Label></div>
                      {!isOpenPrice && <div className="flex items-center gap-3"><Switch name="trackInventory" id="trackInventory" defaultChecked={editProduct?.trackInventory ?? true} /><Label htmlFor="trackInventory">Track Inventory</Label></div>}
                      <div className="flex items-center gap-3"><Switch name="taxable" id="taxable" defaultChecked={editProduct?.taxable ?? true} /><Label htmlFor="taxable">Taxable</Label></div>
                    </div>

                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="commissionEnabled"
                          checked={commissionEnabled}
                          onCheckedChange={setCommissionEnabled}
                          data-testid="switch-commission-enabled"
                        />
                        <Label htmlFor="commissionEnabled">Enable Commission</Label>
                      </div>
                      {commissionEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Commission Type</Label>
                            <Select value={commissionType} onValueChange={setCommissionType}>
                              <SelectTrigger data-testid="select-commission-type"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat_amount">Flat Amount</SelectItem>
                                <SelectItem value="percent_of_profit">% of Profit</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>{commissionType === "flat_amount" ? "Amount ($)" : "Percentage (%)"}</Label>
                            <Input name="commissionValue" type="number" step="0.01" min="0" defaultValue={editProduct?.commissionValue || ""} data-testid="input-commission-value" />
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {commissionType === "flat_amount" && "Fixed payout per unit sold"}
                            {commissionType === "percent_of_profit" && (isSerializedToggle ? "Based on margin — uses actual serialized unit cost" : "Based on margin (selling price minus item cost)")}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-product">
                      {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editProduct ? "Update Product" : "Add Product"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-card-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Cash Price</TableHead>
                      {dualPricingEnabled && <TableHead>Card Price</TableHead>}
                      <TableHead>{selectedStoreId ? "Store Stock" : "Stock"}</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={dualPricingEnabled ? 8 : 7} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
                    ) : (
                      filtered.map((p: any) => {
                        const isSerialized = p.isSerialized;
                        const serializedCount = isSerialized
                          ? inventoryUnits.filter((u: any) => u.productId === p.id && u.status === "in_stock" && (selectedStoreId ? u.storeId === selectedStoreId : true)).length
                          : 0;
                        const storeStock = p.storeStock || {};
                        const companyTotal = p.trackInventory && !isSerialized
                          ? Object.values(storeStock).reduce((sum: number, qty: any) => sum + (Number(qty) || 0), 0) as number
                          : p.quantityOnHand;
                        const displayQty = p.trackInventory && !isSerialized
                          ? (selectedStoreId ? (storeStock[selectedStoreId] ?? 0) : companyTotal)
                          : p.quantityOnHand;
                        const isOutOfStock = !isSerialized && p.trackInventory && displayQty === 0;
                        const isLowStock = !isSerialized && p.trackInventory && !isOutOfStock && displayQty <= p.lowStockThreshold;
                        const serialOutOfStock = isSerialized && serializedCount === 0;
                        const cardPrice = (parseFloat(p.cashPrice) * (1 + uplift / 100)).toFixed(2);
                        return (
                          <TableRow key={p.id} className={isOutOfStock || serialOutOfStock ? "bg-red-50/30 dark:bg-red-950/10" : isLowStock ? "bg-amber-50/30 dark:bg-amber-950/10" : ""} data-testid={`row-product-${p.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded flex items-center justify-center ${isSerialized ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : p.isService ? "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"}`}>
                                  {isSerialized ? <Cpu className="w-3.5 h-3.5" /> : p.isService ? <Tag className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <span className="font-semibold text-sm text-primary">{p.name}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">{p.sku || "\u2014"}</TableCell>
                            <TableCell className="font-semibold tabular-nums">{p.isOpenPrice ? <Badge variant="outline" className="text-xs">Open Price</Badge> : `$${p.cashPrice}`}</TableCell>
                            {dualPricingEnabled && <TableCell className="text-amber-600 dark:text-amber-400 tabular-nums">{p.isOpenPrice ? "—" : `$${cardPrice}`}</TableCell>}
                            <TableCell>
                              {isSerialized ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant={serialOutOfStock ? "destructive" : "secondary"} className="text-xs">
                                      {serializedCount} {serializedCount === 1 ? "unit" : "units"}
                                    </Badge>
                                    {serialOutOfStock && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                  </div>
                                  {isMultiStore && !selectedStoreId && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0">
                                      {stores.filter((s: any) => s.isActive).map((s: any) => {
                                        const storeUnitCount = inventoryUnits.filter((u: any) => u.productId === p.id && u.status === "in_stock" && u.storeId === s.id).length;
                                        return <div key={s.id}>{s.name}: {storeUnitCount}</div>;
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : p.trackInventory ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant={isOutOfStock ? "destructive" : isLowStock ? "secondary" : "secondary"} className={`text-xs ${isLowStock ? "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400" : ""}`}>
                                      <span data-testid={`text-stock-${p.id}`}>{displayQty}</span>
                                    </Badge>
                                    {isOutOfStock && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                    {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                  </div>
                                  {isMultiStore && !selectedStoreId && Object.keys(storeStock).length > 0 && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0">
                                      {stores.filter((s: any) => s.isActive).map((s: any) => (
                                        <div key={s.id}>{s.name}: {storeStock[s.id] ?? 0}</div>
                                      ))}
                                    </div>
                                  )}
                                  {isMultiStore && selectedStoreId && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      Company total: {companyTotal}
                                    </div>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground text-xs">Not tracked</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${isSerialized ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400" : p.isService ? "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400" : ""}`}>
                                {isSerialized ? "Serialized" : p.isService ? "Service" : "Product"}
                              </Badge>
                            </TableCell>
                            <TableCell><Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">{p.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setEditProduct(p); setIsSerializedToggle(!!p.isSerialized); setCommissionEnabled(!!p.commissionEnabled); setCommissionType(p.commissionType || "none"); setIsOpenPrice(!!p.isOpenPrice); setCostCalcMode(p.costCalculationMode || "fixed_cost"); }} data-testid={`button-edit-${p.id}`}><Edit className="w-4 h-4" /></Button>
                                {p.trackInventory && !isSerialized && (
                                  <Button variant="ghost" size="icon" onClick={() => setAdjustProduct(p)} data-testid={`button-adjust-${p.id}`}><ArrowUpDown className="w-4 h-4" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{categories.length} categories</p>
              </div>
              <Dialog open={categoryCreateOpen || !!editCategory} onOpenChange={(open) => { if (!open) { setCategoryCreateOpen(false); setEditCategory(null); } else { setCategoryCreateOpen(true); } }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-category"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>{editCategory ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div><Label>Category Name *</Label><Input name="name" required defaultValue={editCategory?.name} data-testid="input-category-name" /></div>
                    <div><Label>Description</Label><Textarea name="description" defaultValue={editCategory?.description} data-testid="input-category-description" /></div>
                    <div>
                      <Label>Parent Category</Label>
                      <Select name="parentId" defaultValue={editCategory?.parentId?.toString() || "none"}>
                        <SelectTrigger data-testid="select-category-parent"><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (top-level)</SelectItem>
                          {topLevelCategories
                            .filter((c: any) => !editCategory || c.id !== editCategory.id)
                            .map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Subcategories can only be one level deep</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={categoryMutation.isPending} data-testid="button-save-category">
                      {categoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editCategory ? "Update Category" : "Add Category"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-card-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No categories yet. Add one to organize your products.</TableCell></TableRow>
                    ) : (
                      topLevelCategories.map((c: any) => {
                        const subs = getSubcategories(c.id);
                        const directCount = products.filter((p: any) => p.categoryId === c.id).length;
                        const totalCount = directCount + subs.reduce((sum: number, s: any) => sum + products.filter((p: any) => p.categoryId === s.id).length, 0);
                        return [
                          <TableRow key={c.id} data-testid={`row-category-${c.id}`}>
                            <TableCell className="font-medium" data-testid={`text-category-name-${c.id}`}>
                              {c.name}
                              {subs.length > 0 && <span className="text-xs text-muted-foreground ml-2">({subs.length} sub)</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.description || "\u2014"}</TableCell>
                            <TableCell className="text-sm">{totalCount}</TableCell>
                            <TableCell>
                              <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs">
                                {c.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => setEditCategory(c)} data-testid={`button-edit-category-${c.id}`}><Pencil className="w-4 h-4" /></Button>
                            </TableCell>
                          </TableRow>,
                          ...subs.map((s: any) => {
                            const subCount = products.filter((p: any) => p.categoryId === s.id).length;
                            return (
                              <TableRow key={s.id} data-testid={`row-category-${s.id}`} className="bg-muted/30">
                                <TableCell className="font-medium pl-8" data-testid={`text-category-name-${s.id}`}>
                                  <span className="text-muted-foreground mr-1">└</span> {s.name}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{s.description || "\u2014"}</TableCell>
                                <TableCell className="text-sm">{subCount}</TableCell>
                                <TableCell>
                                  <Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">
                                    {s.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" onClick={() => setEditCategory(s)} data-testid={`button-edit-category-${s.id}`}><Pencil className="w-4 h-4" /></Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ];
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="serialized" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search serial/IMEI..." value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} className="pl-9" data-testid="input-search-units" />
                </div>
                <Select value={unitProductFilter} onValueChange={setUnitProductFilter}>
                  <SelectTrigger className="w-48" data-testid="select-unit-product-filter"><SelectValue placeholder="All Products" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {serializedProducts.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={unitStatusFilter} onValueChange={setUnitStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-unit-status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.values(INVENTORY_UNIT_STATUS).map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={receiveOpen} onOpenChange={(open) => { setReceiveOpen(open); if (!open) { setReceiveProductId(""); setReceiveProductPopoverOpen(false); } }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-receive-unit"><Plus className="w-4 h-4 mr-2" /> Receive Stock</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Receive Serialized Stock</DialogTitle></DialogHeader>
                  <form onSubmit={handleReceiveSubmit} className="space-y-4">
                    <div>
                      <Label>Product (serialized only) *</Label>
                      <div ref={productComboRef} className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={receiveProductPopoverOpen}
                          className="w-full justify-between font-normal"
                          onClick={() => setReceiveProductPopoverOpen(!receiveProductPopoverOpen)}
                          data-testid="select-receive-product"
                        >
                          {receiveProductId
                            ? serializedProducts.find((p: any) => p.id.toString() === receiveProductId)?.name || "Select product..."
                            : "Select product..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        {receiveProductPopoverOpen && (
                          <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 rounded-md border bg-popover shadow-md">
                            <Command>
                              <CommandInput placeholder="Search products..." data-testid="input-search-receive-product" />
                              <CommandList className="max-h-[200px]">
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup>
                                  {serializedProducts.map((p: any) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        setReceiveProductId(p.id.toString());
                                        setReceiveProductPopoverOpen(false);
                                      }}
                                      data-testid={`option-receive-product-${p.id}`}
                                    >
                                      <Check className={`mr-2 h-4 w-4 shrink-0 ${receiveProductId === p.id.toString() ? "opacity-100" : "opacity-0"}`} />
                                      {p.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Serial Number</Label><Input name="serialNumber" data-testid="input-serial-number" /></div>
                      <div><Label>IMEI</Label><Input name="imei" data-testid="input-imei" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Condition</Label>
                        <Select name="condition" defaultValue="new">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="used_like_new">Used - Like New</SelectItem>
                            <SelectItem value="used_good">Used - Good</SelectItem>
                            <SelectItem value="used_fair">Used - Fair</SelectItem>
                            <SelectItem value="used_poor">Used - Poor</SelectItem>
                            <SelectItem value="refurbished">Refurbished</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Acquisition Cost ($)</Label><Input name="acquisitionCost" type="number" step="0.01" defaultValue="0.00" data-testid="input-acquisition-cost" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Commission Override</Label>
                        <Select name="unitCommissionType" defaultValue="">
                          <SelectTrigger data-testid="select-unit-commission-type"><SelectValue placeholder="Use product default" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None (Disabled)</SelectItem>
                            <SelectItem value="flat_amount">Flat Amount</SelectItem>
                            <SelectItem value="percent_of_profit">% of Profit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Commission Value</Label>
                        <Input name="unitCommissionValue" type="number" step="0.01" min="0" placeholder="Product default" data-testid="input-unit-commission-value" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Source</Label>
                        <Select name="sourceType" defaultValue="manual">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.values(INVENTORY_UNIT_SOURCE).map(s => <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Vendor</Label>
                        <Select name="vendorId">
                          <SelectTrigger data-testid="select-receive-vendor"><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>
                            {vendors.map((v: any) => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Store</Label>
                      <Select name="storeId">
                        <SelectTrigger><SelectValue placeholder="Default store" /></SelectTrigger>
                        <SelectContent>
                          {stores.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Notes</Label><Textarea name="notes" /></div>
                    <Button type="submit" className="w-full" disabled={receiveUnitMutation.isPending} data-testid="button-save-unit">
                      {receiveUnitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Receive Unit
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-card-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial #</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Store</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryUnits.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No serialized units found</TableCell></TableRow>
                    ) : (
                      inventoryUnits.map((u: any) => (
                        <TableRow key={u.id} data-testid={`row-unit-${u.id}`}>
                          <TableCell className="font-mono text-sm" data-testid={`text-serial-${u.id}`}>{u.serialNumber || "\u2014"}</TableCell>
                          <TableCell className="font-mono text-sm" data-testid={`text-imei-${u.id}`}>{u.imei || "\u2014"}</TableCell>
                          <TableCell className="text-sm">{productMap[u.productId]?.name || `Product #${u.productId}`}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(u.status)} data-testid={`badge-status-${u.id}`}>
                              {statusLabel(u.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{conditionLabel(u.condition)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sourceLabel(u.sourceType)}</TableCell>
                          <TableCell className="text-sm">${u.acquisitionCost}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{storeMap[u.storeId]?.name || "\u2014"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{vendors.length} vendors</p>
              <Dialog open={vendorCreateOpen || !!editVendor} onOpenChange={(open) => { if (!open) { setVendorCreateOpen(false); setEditVendor(null); } else { setVendorCreateOpen(true); } }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-vendor"><Plus className="w-4 h-4 mr-2" /> Add Vendor</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>{editVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
                  <form onSubmit={handleVendorSubmit} className="space-y-4">
                    <div><Label>Vendor Name *</Label><Input name="name" required defaultValue={editVendor?.name} data-testid="input-vendor-name" /></div>
                    <div><Label>Contact Name</Label><Input name="contactName" defaultValue={editVendor?.contactName} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Email</Label><Input name="email" type="email" defaultValue={editVendor?.email} /></div>
                      <div><Label>Phone</Label><Input name="phone" defaultValue={editVendor?.phone} /></div>
                    </div>
                    <div><Label>Notes</Label><Textarea name="notes" defaultValue={editVendor?.notes} /></div>
                    <Button type="submit" className="w-full" disabled={vendorMutation.isPending} data-testid="button-save-vendor">
                      {vendorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editVendor ? "Update Vendor" : "Add Vendor"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="border-card-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No vendors yet</TableCell></TableRow>
                    ) : (
                      vendors.map((v: any) => (
                        <TableRow key={v.id} data-testid={`row-vendor-${v.id}`}>
                          <TableCell className="font-medium" data-testid={`text-vendor-name-${v.id}`}>{v.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.contactName || "\u2014"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.email || "\u2014"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.phone || "\u2014"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => setEditVendor(v)} data-testid={`button-edit-vendor-${v.id}`}><Edit className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {stores.length > 1 && (
            <TabsContent value="transfers" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{transfers.length} transfers</p>
                <div className="flex gap-2">
                  <Dialog open={stdTransferOpen} onOpenChange={(open) => {
                    setStdTransferOpen(open);
                    if (!open) {
                      setStdTransferFromStore("");
                      setStdTransferToStore("");
                      setStdTransferProductId("");
                      setStdTransferQty("");
                      setStdTransferNotes("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-new-std-transfer"><Package className="w-4 h-4 mr-2" /> Standard Transfer</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Transfer Standard Product</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>From Store *</Label>
                            <Select value={stdTransferFromStore} onValueChange={setStdTransferFromStore}>
                              <SelectTrigger data-testid="select-std-transfer-from"><SelectValue placeholder="Source..." /></SelectTrigger>
                              <SelectContent>
                                {stores.filter((s: any) => s.isActive).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>To Store *</Label>
                            <Select value={stdTransferToStore} onValueChange={setStdTransferToStore}>
                              <SelectTrigger data-testid="select-std-transfer-to"><SelectValue placeholder="Destination..." /></SelectTrigger>
                              <SelectContent>
                                {stores.filter((s: any) => s.isActive && s.id.toString() !== stdTransferFromStore).map((s: any) => (
                                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Product *</Label>
                          <Select value={stdTransferProductId} onValueChange={setStdTransferProductId}>
                            <SelectTrigger data-testid="select-std-transfer-product"><SelectValue placeholder="Select product..." /></SelectTrigger>
                            <SelectContent>
                              {products.filter((p: any) => !p.isSerialized && !p.isService && p.trackInventory).map((p: any) => {
                                const srcStock = stdTransferFromStore && p.storeStock ? (p.storeStock[parseInt(stdTransferFromStore)] ?? 0) : p.quantityOnHand;
                                return (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name} (avail: {srcStock})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Quantity *</Label>
                          <Input type="number" min="1" value={stdTransferQty} onChange={(e) => setStdTransferQty(e.target.value)} placeholder="How many units..." data-testid="input-std-transfer-qty" />
                        </div>
                        <div>
                          <Label>Notes (optional)</Label>
                          <Textarea value={stdTransferNotes} onChange={(e) => setStdTransferNotes(e.target.value)} placeholder="Transfer reason..." data-testid="input-std-transfer-notes" />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => createStdTransferMutation.mutate()}
                          disabled={!stdTransferFromStore || !stdTransferToStore || !stdTransferProductId || !stdTransferQty || parseInt(stdTransferQty) <= 0 || createStdTransferMutation.isPending}
                          data-testid="button-create-std-transfer"
                        >
                          {createStdTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Create Standard Transfer
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={transferOpen} onOpenChange={(open) => {
                    setTransferOpen(open);
                    if (!open) {
                      setTransferFromStore("");
                      setTransferToStore("");
                      setTransferNotes("");
                      setSelectedTransferUnits([]);
                      setTransferUnitSearch("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-new-transfer"><Cpu className="w-4 h-4 mr-2" /> Serialized Transfer</Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Create Inter-Store Transfer</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>From Store *</Label>
                          <Select value={transferFromStore} onValueChange={(v) => { setTransferFromStore(v); setSelectedTransferUnits([]); }}>
                            <SelectTrigger data-testid="select-transfer-from"><SelectValue placeholder="Source store..." /></SelectTrigger>
                            <SelectContent>
                              {stores.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>To Store *</Label>
                          <Select value={transferToStore} onValueChange={setTransferToStore}>
                            <SelectTrigger data-testid="select-transfer-to"><SelectValue placeholder="Destination store..." /></SelectTrigger>
                            <SelectContent>
                              {stores.filter((s: any) => s.id.toString() !== transferFromStore).map((s: any) => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {transferFromStore && (
                        <div className="space-y-2">
                          <Label>Select Units to Transfer</Label>
                          <Input
                            placeholder="Search by serial or IMEI..."
                            value={transferUnitSearch}
                            onChange={(e) => setTransferUnitSearch(e.target.value)}
                            data-testid="input-transfer-unit-search"
                          />
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                            {availableUnitsForTransfer.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">No available units in this store</div>
                            ) : (
                              availableUnitsForTransfer.map((u: any) => {
                                const product = products.find((p: any) => p.id === u.productId);
                                const selected = selectedTransferUnits.includes(u.id);
                                return (
                                  <div
                                    key={u.id}
                                    className={`flex items-center gap-3 p-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 ${selected ? "bg-primary/10" : ""}`}
                                    onClick={() => {
                                      setSelectedTransferUnits(prev =>
                                        selected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                      );
                                    }}
                                    data-testid={`transfer-unit-${u.id}`}
                                  >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                                      {selected && <Check className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{product?.name || `Product #${u.productId}`}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {u.serialNumber && <span>SN: {u.serialNumber}</span>}
                                        {u.serialNumber && u.imei && <span> · </span>}
                                        {u.imei && <span>IMEI: {u.imei}</span>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{selectedTransferUnits.length} unit(s) selected</div>
                        </div>
                      )}

                      <div>
                        <Label>Notes (optional)</Label>
                        <Textarea value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="Transfer reason or notes..." data-testid="input-transfer-notes" />
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => createTransferMutation.mutate()}
                        disabled={!transferFromStore || !transferToStore || selectedTransferUnits.length === 0 || transferFromStore === transferToStore || createTransferMutation.isPending}
                        data-testid="button-create-transfer"
                      >
                        {createTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Transfer ({selectedTransferUnits.length} units)
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              <Card className="border-card-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell></TableRow>
                      ) : (
                        transfers.map((t: any) => {
                          const isStandard = t.transferType === "standard";
                          const productName = isStandard ? products.find((p: any) => p.id === t.productId)?.name : null;
                          return (
                          <TableRow key={t.id} data-testid={`row-transfer-${t.id}`}>
                            <TableCell className="font-mono text-sm" data-testid={`text-transfer-id-${t.id}`}>#{t.id}</TableCell>
                            <TableCell data-testid={`text-transfer-from-${t.id}`}>{t.fromStoreName}</TableCell>
                            <TableCell data-testid={`text-transfer-to-${t.id}`}>{t.toStoreName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {isStandard ? "Standard" : "Serialized"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isStandard
                                ? <span className="text-sm">{productName || `Product #${t.productId}`} × {t.quantity}</span>
                                : <span className="text-sm">{t.items?.length || 0} units</span>
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.status === "completed" ? "default" : t.status === "cancelled" ? "destructive" : "secondary"} data-testid={`badge-transfer-status-${t.id}`}>
                                {statusLabel(t.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{t.initiatedByName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              {t.status === "pending" && (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => completeTransferMutation.mutate(t.id)}
                                    disabled={completeTransferMutation.isPending}
                                    data-testid={`button-complete-transfer-${t.id}`}
                                    title="Complete transfer"
                                  >
                                    <Check className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelTransferMutation.mutate(t.id)}
                                    disabled={cancelTransferMutation.isPending}
                                    data-testid={`button-cancel-transfer-${t.id}`}
                                    title="Cancel transfer"
                                  >
                                    <X className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );})
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={!!adjustProduct} onOpenChange={(open) => { if (!open) { setAdjustProduct(null); setAdjustStoreId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Stock: {adjustProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Total stock: <span className="font-medium text-foreground">{adjustProduct?.quantityOnHand}</span>
              {stores.length > 1 && adjustProduct?.storeStock && Object.keys(adjustProduct.storeStock).length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {stores.filter((s: any) => s.isActive).map((s: any) => (
                    <div key={s.id} className="text-xs">{s.name}: {adjustProduct.storeStock[s.id] ?? 0}</div>
                  ))}
                </div>
              )}
            </div>
            {stores.length > 1 && (
              <div>
                <Label>Target Store</Label>
                <Select value={adjustStoreId} onValueChange={setAdjustStoreId}>
                  <SelectTrigger data-testid="select-adjust-store"><SelectValue placeholder="Select store..." /></SelectTrigger>
                  <SelectContent>
                    {stores.filter((s: any) => s.isActive).map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Quantity Change (+/-)</Label><Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. +10 or -5" data-testid="input-adjust-qty" /></div>
            <div><Label>Reason</Label><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Restock, damaged, count correction..." /></div>
            <Button className="w-full" onClick={() => adjustMutation.mutate()} disabled={!adjustQty || adjustMutation.isPending || (stores.length > 1 && !adjustStoreId)} data-testid="button-confirm-adjust">
              {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Adjust Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickAddCategoryOpen} onOpenChange={setQuickAddCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Quick Add Category</DialogTitle></DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div><Label>Category Name *</Label><Input name="name" required data-testid="input-quick-category-name" /></div>
            <div><Label>Description</Label><Textarea name="description" data-testid="input-quick-category-description" /></div>
            <Button type="submit" className="w-full" disabled={categoryMutation.isPending} data-testid="button-save-quick-category">
              {categoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Category
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
