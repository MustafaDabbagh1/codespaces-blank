import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MerchantLayout from "@/components/merchant-layout";
import { useStoreContext } from "@/contexts/store-context";
import { useStationContext } from "@/contexts/station-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, Minus, Trash2, User, ShoppingCart, CreditCard, Banknote, CheckCircle, X, Package, Tag, Loader2, Cpu, DollarSign, Printer, Mail, UserPlus, PenLine, Wifi, WifiOff, AlertTriangle, MapPin, Store, ChevronDown } from "lucide-react";

interface CartItem {
  productId: number | null;
  name: string;
  cashUnitPrice: number;
  quantity: number;
  taxable: boolean;
  isSerialized?: boolean;
  isManual?: boolean;
  isOpenPrice?: boolean;
  openPriceAmount?: string;
  manualCost?: string;
  inventoryUnitId?: number;
  serialNumber?: string;
  imei?: string;
  trackInventory?: boolean;
  quantityOnHand?: number;
}

export default function POSPage() {
  const { toast } = useToast();
  const { selectedStoreId, selectedStore } = useStoreContext();
  const { selectedStation } = useStationContext();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState<any>(null);
  const [manualEmailOpen, setManualEmailOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [unitSelectProductId, setUnitSelectProductId] = useState<number | null>(null);
  const [unitSelectProductName, setUnitSelectProductName] = useState("");
  const [unitSearch, setUnitSearch] = useState("");

  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");

  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customQty, setCustomQty] = useState("1");

  const [openPriceProduct, setOpenPriceProduct] = useState<any>(null);
  const [openPriceValue, setOpenPriceValue] = useState("");
  const [openPriceCost, setOpenPriceCost] = useState("");
  const [pendingOpenPriceData, setPendingOpenPriceData] = useState<{ amt: number; manualCost?: string } | null>(null);
  const [customTaxable, setCustomTaxable] = useState(true);

  const [createCustOpen, setCreateCustOpen] = useState(false);
  const [newCustFirst, setNewCustFirst] = useState("");
  const [newCustLast, setNewCustLast] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPayMethod, setCheckoutPayMethod] = useState<"cash" | "card" | null>(null);
  const [cashTendered, setCashTendered] = useState("");
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<{ message: string; detail?: string; type?: string } | null>(null);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState<string>(crypto.randomUUID());

  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/products"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/categories"] });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/customers"] });
  const { data: settingsData } = useQuery<any>({ queryKey: ["/api/merchant/settings"] });
  const { data: taxRates = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/tax-rates"] });

  const { data: rawTerminalStatus } = useQuery<any>({
    queryKey: ["/api/merchant/pos/terminal-status", selectedStoreId],
    queryFn: async () => {
      const storeParam = selectedStoreId ? `?storeId=${selectedStoreId}` : "";
      const res = await fetch(`/api/merchant/pos/terminal-status${storeParam}`, { credentials: "include" });
      if (!res.ok) return { hasTerminal: false, reason: "error", terminals: [] };
      return res.json();
    },
  });

  const terminalStatus = useMemo(() => {
    if (!rawTerminalStatus) return rawTerminalStatus;
    const stationTerminalId = selectedStation?.defaultTerminalId;
    if (!stationTerminalId) return rawTerminalStatus;
    const stationTerminal = rawTerminalStatus.terminals?.find((t: any) => t.id === stationTerminalId);
    if (!stationTerminal) return rawTerminalStatus;
    return {
      ...rawTerminalStatus,
      terminalId: stationTerminal.id,
      terminalName: stationTerminal.name,
      terminalType: stationTerminal.type,
    };
  }, [rawTerminalStatus, selectedStation?.defaultTerminalId]);

  const { data: availableUnits = [], isLoading: unitsLoading } = useQuery<any[]>({
    queryKey: ["/api/merchant/products", unitSelectProductId, "available-units"],
    queryFn: async () => {
      if (!unitSelectProductId) return [];
      const res = await fetch(`/api/merchant/products/${unitSelectProductId}/available-units`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: !!unitSelectProductId,
  });

  const settings = settingsData?.settings;
  const dualPricingEnabled = settings?.dualPricingEnabled || false;
  const cardUpliftPercent = parseFloat(settings?.cardUpliftPercent || "3.50");
  const defaultTaxRate = taxRates.find((r: any) => r.isDefault && r.isActive) || taxRates.find((r: any) => r.isActive) || null;
  const taxRate = defaultTaxRate ? parseFloat(defaultTaxRate.rate) : 0;

  const topLevelCategories = useMemo(() => categories.filter((c: any) => c.isActive && !c.parentId), [categories]);
  const getSubcategories = (parentId: number) => categories.filter((c: any) => c.isActive && c.parentId === parentId);
  const [expandedParent, setExpandedParent] = useState<number | null>(null);

  const handleCategoryClick = (catId: number | null) => {
    if (catId === null) {
      setSelectedCategory(null);
      setExpandedParent(null);
      return;
    }
    const cat = categories.find((c: any) => c.id === catId);
    if (!cat) return;
    if (!cat.parentId) {
      const subs = getSubcategories(catId);
      if (subs.length > 0) {
        setExpandedParent(catId);
        setSelectedCategory(catId);
      } else {
        setSelectedCategory(catId);
        setExpandedParent(null);
      }
    } else {
      setSelectedCategory(catId);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p: any) => p.isActive);
    if (selectedCategory) {
      const childIds = getSubcategories(selectedCategory).map((c: any) => c.id);
      filtered = filtered.filter((p: any) => p.categoryId === selectedCategory || childIds.includes(p.categoryId));
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s));
    }
    return filtered;
  }, [products, selectedCategory, search, categories]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 10);
    const s = customerSearch.toLowerCase();
    return customers.filter((c: any) =>
      c.firstName.toLowerCase().includes(s) || c.lastName.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) || c.phone?.includes(s)
    );
  }, [customers, customerSearch]);

  const filteredUnits = useMemo(() => {
    if (!unitSearch) return availableUnits;
    const s = unitSearch.toLowerCase();
    return availableUnits.filter((u: any) =>
      u.serialNumber?.toLowerCase().includes(s) || u.imei?.toLowerCase().includes(s)
    );
  }, [availableUnits, unitSearch]);

  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  const calcCardPrice = (cashPrice: number) => Math.round(cashPrice * (1 + cardUpliftPercent / 100) * 100) / 100;

  const subtotalCash = cart.reduce((sum, item) => sum + item.cashUnitPrice * item.quantity, 0);
  const subtotalCard = cart.reduce((sum, item) => sum + calcCardPrice(item.cashUnitPrice) * item.quantity, 0);

  const computeTotals = (method: "cash" | "card") => {
    const activeSubtotal = method === "card" && dualPricingEnabled ? subtotalCard : subtotalCash;
    let disc = 0;
    if (discountType !== "none" && discountValue) {
      const val = parseFloat(discountValue);
      if (!isNaN(val) && val > 0) {
        disc = discountType === "percent" ? Math.round(activeSubtotal * (val / 100) * 100) / 100 : Math.min(val, activeSubtotal);
      }
    }
    const discountedSubtotal = activeSubtotal - disc;
    const preDiscountTax = cart
      .filter(item => item.taxable)
      .reduce((sum, item) => {
        const price = method === "card" && dualPricingEnabled ? calcCardPrice(item.cashUnitPrice) : item.cashUnitPrice;
        return sum + Math.round(price * item.quantity * taxRate * 100) / 100;
      }, 0);
    const tax = activeSubtotal > 0 ? Math.round(preDiscountTax * (discountedSubtotal / activeSubtotal) * 100) / 100 : 0;
    const total = Math.round((discountedSubtotal + tax) * 100) / 100;
    return { subtotal: activeSubtotal, discount: disc, tax, total };
  };

  const cashTotals = computeTotals("cash");
  const cardTotals = computeTotals("card");
  const activeTotals = checkoutPayMethod === "card" ? cardTotals : cashTotals;

  const discountAmount = cashTotals.discount;
  const checkoutDiscount = checkoutPayMethod ? activeTotals.discount : cashTotals.discount;
  const finalTotal = checkoutPayMethod ? activeTotals.total : cashTotals.total;

  const stockWarnings = useMemo(() => {
    const warnings: string[] = [];
    const aggByProduct: Record<number, { name: string; qty: number; onHand: number }> = {};
    for (const item of cart) {
      if (item.productId && item.trackInventory && !item.isSerialized && !item.isManual) {
        if (!aggByProduct[item.productId]) {
          aggByProduct[item.productId] = { name: item.name, qty: 0, onHand: item.quantityOnHand ?? 0 };
        }
        aggByProduct[item.productId].qty += item.quantity;
      }
    }
    for (const [, info] of Object.entries(aggByProduct)) {
      if (info.qty > info.onHand) {
        warnings.push(`${info.name}: ${info.qty} in cart but only ${info.onHand} in stock`);
      }
    }
    return warnings;
  }, [cart]);

  const addToCart = (product: any) => {
    if (product.isOpenPrice) {
      setOpenPriceProduct(product);
      setOpenPriceValue("");
      setOpenPriceCost("");
      return;
    }

    if (product.isSerialized) {
      setUnitSelectProductId(product.id);
      setUnitSelectProductName(product.name);
      setUnitSearch("");
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id && !i.isSerialized && !i.isManual && !i.isOpenPrice);
      if (existing) {
        return prev.map(i => i.productId === product.id && !i.isSerialized && !i.isManual && !i.isOpenPrice ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        cashUnitPrice: parseFloat(product.cashPrice),
        quantity: 1,
        taxable: product.taxable,
        trackInventory: product.trackInventory,
        quantityOnHand: product.quantityOnHand,
      }];
    });
  };

  const confirmOpenPriceItem = () => {
    if (!openPriceProduct) return;
    const amt = parseFloat(openPriceValue);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid sale price.", variant: "destructive" });
      return;
    }
    if (openPriceProduct.minOpenPrice && amt < parseFloat(openPriceProduct.minOpenPrice)) {
      toast({ title: "Below minimum", description: `Minimum price is $${parseFloat(openPriceProduct.minOpenPrice).toFixed(2)}`, variant: "destructive" });
      return;
    }
    if (openPriceProduct.maxOpenPrice && amt > parseFloat(openPriceProduct.maxOpenPrice)) {
      toast({ title: "Above maximum", description: `Maximum price is $${parseFloat(openPriceProduct.maxOpenPrice).toFixed(2)}`, variant: "destructive" });
      return;
    }
    if (openPriceProduct.isSerialized) {
      setPendingOpenPriceData({ amt, manualCost: openPriceProduct.costCalculationMode === "manual_cost_at_sale" && openPriceCost ? openPriceCost : undefined });
      setUnitSelectProductId(openPriceProduct.id);
      setUnitSelectProductName(openPriceProduct.name);
      setUnitSearch("");
      setOpenPriceProduct(null);
      setOpenPriceValue("");
      setOpenPriceCost("");
      return;
    }
    setCart(prev => [...prev, {
      productId: openPriceProduct.id,
      name: openPriceProduct.name,
      cashUnitPrice: amt,
      quantity: 1,
      taxable: openPriceProduct.taxable,
      isOpenPrice: true,
      openPriceAmount: amt.toFixed(2),
      manualCost: openPriceProduct.costCalculationMode === "manual_cost_at_sale" && openPriceCost ? openPriceCost : undefined,
      trackInventory: false,
    }]);
    setOpenPriceProduct(null);
    setOpenPriceValue("");
    setOpenPriceCost("");
  };

  const addSerializedUnit = (unit: any) => {
    const alreadyInCart = cart.some(i => i.inventoryUnitId === unit.id);
    if (alreadyInCart) {
      toast({ title: "Already in cart", description: "This unit is already added to the cart.", variant: "destructive" });
      return;
    }

    const product = products.find((p: any) => p.id === unit.productId);

    if (pendingOpenPriceData && product?.isOpenPrice) {
      setCart(prev => [...prev, {
        productId: unit.productId,
        name: unitSelectProductName,
        cashUnitPrice: pendingOpenPriceData.amt,
        quantity: 1,
        taxable: product?.taxable ?? true,
        isSerialized: true,
        inventoryUnitId: unit.id,
        serialNumber: unit.serialNumber,
        imei: unit.imei,
        isOpenPrice: true,
        openPriceAmount: pendingOpenPriceData.amt.toFixed(2),
        manualCost: pendingOpenPriceData.manualCost,
      }]);
      setPendingOpenPriceData(null);
    } else {
      const cashPrice = product ? parseFloat(product.cashPrice || "0") : 0;
      setCart(prev => [...prev, {
        productId: unit.productId,
        name: unitSelectProductName,
        cashUnitPrice: cashPrice,
        quantity: 1,
        taxable: product?.taxable ?? true,
        isSerialized: true,
        inventoryUnitId: unit.id,
        serialNumber: unit.serialNumber,
        imei: unit.imei,
      }]);
    }

    setUnitSelectProductId(null);
    setUnitSelectProductName("");
  };

  const addCustomItem = () => {
    const amount = parseFloat(customAmount);
    const qty = parseInt(customQty) || 1;
    if (!customDesc.trim() || isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid item", description: "Enter a description and valid amount.", variant: "destructive" });
      return;
    }
    setCart(prev => [...prev, {
      productId: null,
      name: customDesc.trim(),
      cashUnitPrice: amount,
      quantity: qty,
      taxable: customTaxable,
      isManual: true,
    }]);
    setCustomItemOpen(false);
    setCustomDesc("");
    setCustomAmount("");
    setCustomQty("1");
    setCustomTaxable(true);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index];
      if (item.isSerialized) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: Math.max(1, updated[index].quantity + delta) };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const openCheckout = () => {
    setCheckoutPayMethod(null);
    setCashTendered("");
    setSelectedTerminalId(terminalStatus?.terminalId ?? null);
    setCheckoutError(null);
    setCheckoutIdempotencyKey(crypto.randomUUID());
    setCheckoutOpen(true);
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/merchant/customers", {
        firstName: newCustFirst.trim(),
        lastName: newCustLast.trim(),
        email: newCustEmail.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/customers"] });
      setCustomerId(data.id);
      setCreateCustOpen(false);
      setNewCustFirst("");
      setNewCustLast("");
      setNewCustEmail("");
      setNewCustPhone("");
      toast({ title: "Customer created", description: `${data.firstName} ${data.lastName} added and attached to cart.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create customer", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const paymentMethod = checkoutPayMethod!;
      setCheckoutError(null);
      const res = await fetch("/api/merchant/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            description: item.name,
            cashUnitPrice: item.cashUnitPrice.toFixed(2),
            quantity: item.quantity,
            isManual: item.isManual || false,
            taxable: item.taxable,
            ...(item.inventoryUnitId ? { inventoryUnitId: item.inventoryUnitId } : {}),
            ...(item.openPriceAmount ? { openPriceAmount: item.openPriceAmount } : {}),
            ...(item.manualCost ? { manualCost: item.manualCost } : {}),
          })),
          customerId,
          paymentMethod,
          discountTotal: checkoutDiscount.toFixed(2),
          discountType: discountType !== "none" ? discountType : undefined,
          discountValue: discountType !== "none" && discountValue ? discountValue : undefined,
          storeId: selectedStoreId,
          ...(paymentMethod === "card" && selectedTerminalId ? { terminalId: selectedTerminalId } : {}),
          idempotencyKey: checkoutIdempotencyKey,
        }),
        credentials: "include",
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(res.ok ? "Invalid response from server" : `Checkout failed (${res.status})`);
      }
      if (!res.ok) {
        const err: any = new Error(json.message || "Checkout failed");
        err.errorType = json.errorType;
        err.detail = json.detail;
        throw err;
      }
      return json;
    },
    onSuccess: (data) => {
      try {
        const custName = selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : null;
        const custEmail = selectedCustomer?.email || null;
        setSuccessDialog({
          saleId: data.sale?.id,
          saleNumber: data.saleNumber,
          finalTotal: data.finalTotal,
          pricingMode: data.pricingMode,
          paymentMethod: data.paymentMethod || data.pricingMode,
          cardDetails: data.cardDetails,
          customerId,
          customerName: custName,
          customerEmail: custEmail,
          receiptData: data.receiptData,
          isDuplicate: data.duplicate || false,
        });
        setCart([]);
        setCustomerId(null);
        setDiscountType("none");
        setDiscountValue("");
        setCheckoutOpen(false);
        setCheckoutPayMethod(null);
        setCheckoutError(null);
        setCheckoutIdempotencyKey(crypto.randomUUID());
        queryClient.invalidateQueries({ queryKey: ["/api/merchant/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/merchant/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/merchant/products"] });
      } catch (e) {
        console.error("[POS] onSuccess handler error:", e);
        toast({ title: "Sale completed", description: `Sale ${data.saleNumber || ""} processed but display error occurred. Check sales history.` });
        setCart([]);
        setCheckoutOpen(false);
        setCheckoutIdempotencyKey(crypto.randomUUID());
      }
    },
    onError: (err: any) => {
      const msg = err.message || "Transaction could not be completed";
      const errorType = err.errorType || "";
      setCheckoutError({
        message: errorType === "already_completed"
          ? "This sale may already have been completed. Please check Sales history before retrying."
          : msg,
        detail: err.detail,
        type: errorType || undefined,
      });
    },
  });

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

  const escHtml = (s: string | null | undefined) => {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  const handlePrintReceipt = () => {
    if (!successDialog) return;
    const r = successDialog.receiptData;
    const rs = settings || {};
    const storeName = r?.storeName || settingsData?.tenant?.businessName || "Receipt";
    const storeAddr = r?.storeAddress || "";
    const storePhone = r?.storePhone || "";
    const storeEmail = settingsData?.tenant?.primaryEmail || "";
    const logoUrl = settings?.logoUrl || null;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const showSerial = rs.receiptShowSerialImei !== false;
    const itemRows = (r?.items || []).map((item: any) => {
      const qty = item.quantity > 1 ? `${item.quantity} x $${escHtml(item.unitPrice)}` : "";
      const serialLine = showSerial && item.serialNumber ? `S/N: ${escHtml(item.serialNumber)}` : "";
      const imeiLine = showSerial && item.imei ? `IMEI: ${escHtml(item.imei)}` : "";
      const identifiers = [serialLine, imeiLine].filter(Boolean).join(" · ");
      const subLines = [qty, identifiers].filter(Boolean).map(s => `<br/><span class="sub">${s}</span>`).join("");
      return `<div class="line"><span>${escHtml(item.description)}${subLines}</span><span>$${escHtml(item.lineTotal)}</span></div>`;
    }).join("");

    const cardLine = successDialog.cardDetails?.cardBrand
      ? `<div class="line"><span>Card</span><span>${escHtml(successDialog.cardDetails.cardBrand)} ****${escHtml(successDialog.cardDetails.cardLast4)}</span></div>
         ${successDialog.cardDetails.entryMode ? `<div class="line"><span>Entry</span><span>${escHtml(successDialog.cardDetails.entryMode)}</span></div>` : ""}`
      : "";
    const authLine = r?.authCode ? `<div class="line"><span>Auth Code</span><span>${escHtml(r.authCode)}</span></div>` : "";
    const refLine = r?.transactionRef ? `<div class="line"><span>Ref #</span><span>${escHtml(r.transactionRef)}</span></div>` : "";
    const discLabel = r?.discountType === "percent" && r?.discountValue ? `Discount (${r.discountValue}%)` : "Discount";
    const showDisc = rs.receiptShowDiscountLine !== false;
    const discLine = showDisc && r?.discountTotal && parseFloat(r.discountTotal) > 0 ? `<div class="line"><span>${discLabel}</span><span>-$${r.discountTotal}</span></div>` : "";

    const footerMsg = rs.receiptFooterText ?? "Thank you for your business!";
    const returnPolicy = rs.receiptReturnPolicy || "";
    const warrantyText = rs.receiptWarrantyText || "";
    const footerLines = [footerMsg, returnPolicy, warrantyText].filter(Boolean).map(t => `<p class="footer">${escHtml(t)}</p>`).join("");

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
        .sub{font-size:9px;color:#444}
        hr{border:none;border-top:1px dashed #000;margin:4px 0}
        .total{font-weight:bold;font-size:13px}
        .footer{text-align:center;font-size:9px;margin-top:6px;margin-bottom:0;color:#666}
        @media print{html,body{width:72mm;max-width:72mm;margin:0;padding:4mm 3mm 2mm;height:auto!important;min-height:0!important}@page{size:80mm auto;margin:0}}
      </style></head><body>
      ${rs.receiptShowLogo !== false && logoUrl ? `<div style="text-align:center;margin-bottom:4px"><img src="${escHtml(logoUrl)}" alt="" style="max-width:40mm;max-height:15mm;object-fit:contain" /></div>` : ""}
      ${rs.receiptShowBusinessName !== false ? `<h2>${escHtml(settingsData?.tenant?.businessName || storeName)}</h2>` : ""}
      ${rs.receiptShowStoreName !== false && storeName !== settingsData?.tenant?.businessName ? `<p class="center">${escHtml(storeName)}</p>` : ""}
      ${rs.receiptShowAddress !== false && storeAddr ? `<p class="center">${escHtml(storeAddr)}</p>` : ""}
      ${rs.receiptShowPhone !== false && storePhone ? `<p class="center">${escHtml(storePhone)}</p>` : ""}
      ${rs.receiptShowEmailWebsite && storeEmail ? `<p class="center">${escHtml(storeEmail)}</p>` : ""}
      <hr/>
      <div class="line"><span>Sale #</span><span>${escHtml(successDialog.saleNumber)}</span></div>
      <div class="line"><span>Date</span><span>${dateStr} ${timeStr}</span></div>
      ${rs.receiptShowCashierName !== false ? `<div class="line"><span>Cashier</span><span>${escHtml(r?.employeeName)}</span></div>` : ""}
      ${rs.receiptShowCustomerName !== false && successDialog.customerName ? `<div class="line"><span>Customer</span><span>${escHtml(successDialog.customerName)}</span></div>` : ""}
      <hr/>
      ${itemRows || '<div class="line"><span>Item</span><span>$' + successDialog.finalTotal + '</span></div>'}
      <hr/>
      <div class="line"><span>Subtotal</span><span>$${r?.subtotal || successDialog.finalTotal}</span></div>
      ${discLine}
      ${rs.receiptShowTaxLine !== false ? `<div class="line"><span>Tax</span><span>$${r?.taxTotal || "0.00"}</span></div>` : ""}
      <div class="line total"><span>TOTAL</span><span>$${successDialog.finalTotal}</span></div>
      <hr/>
      <div class="line"><span>Payment</span><span>${successDialog.paymentMethod === "card" ? "Card" : "Cash"}</span></div>
      ${rs.receiptShowPricingMode !== false && successDialog.pricingMode && dualPricingEnabled ? `<div class="line"><span>Pricing</span><span>${successDialog.pricingMode === "card" ? "Card Rate" : "Cash Rate"}</span></div>` : ""}
      ${cardLine}
      ${authLine}
      ${refLine}
      <div class="line"><span>Status</span><span>COMPLETED</span></div>
      ${footerLines ? `<hr/>${footerLines}` : ""}
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

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      new: "New",
      used_like_new: "Like New",
      used_good: "Good",
      used_fair: "Fair",
      used_poor: "Poor",
      refurbished: "Refurbished",
    };
    return labels[condition] || condition;
  };

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, Math.round((cashTenderedNum - activeTotals.total) * 100) / 100);
  const quickTenders = useMemo(() => {
    const t = activeTotals.total;
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
  }, [activeTotals.total]);

  const noStoreSelected = !selectedStoreId;

  return (
    <MerchantLayout>
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)]">
        {/* Left: Cart */}
        <div className="w-full lg:w-[420px] flex flex-col">
          <Card className="border-card-border flex-1 flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Cart
                  {cart.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>}
                </CardTitle>
              </div>
              {selectedStore && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Store className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{selectedStore.name}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto pb-0 px-3">
              {/* Customer */}
              <div className="mb-3">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between px-2.5 py-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
                        {selectedCustomer.email && <span className="text-xs text-muted-foreground truncate block">{selectedCustomer.email}</span>}
                      </div>
                    </div>
                    <button onClick={() => setCustomerId(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-muted-foreground h-9" onClick={() => setCustomerDialogOpen(true)} data-testid="button-attach-customer">
                    <User className="w-3.5 h-3.5 mr-2" />
                    Attach Customer (Walk-in)
                  </Button>
                )}
              </div>

              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted/60 flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">No items yet</p>
                  <p className="text-xs mt-1">Select products from the catalog to start a sale</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cart.map((item, index) => {
                    const cardPrice = calcCardPrice(item.cashUnitPrice);
                    return (
                      <div key={item.inventoryUnitId ? `unit-${item.inventoryUnitId}` : item.isManual ? `custom-${index}` : `item-${index}`} className="flex items-center gap-2 px-2.5 py-2 border border-border rounded-lg group" data-testid={`cart-item-${index}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1">
                            {item.isSerialized && <Cpu className="w-3 h-3 text-violet-500 shrink-0" />}
                            {item.isManual && <PenLine className="w-3 h-3 text-muted-foreground shrink-0" />}
                            <span className="truncate">{item.name}</span>
                          </div>
                          {item.isSerialized && (item.serialNumber || item.imei) && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {item.serialNumber && <span data-testid={`text-serial-${index}`}>S/N: {item.serialNumber}</span>}
                              {item.serialNumber && item.imei && <span> · </span>}
                              {item.imei && <span data-testid={`text-imei-${index}`}>IMEI: {item.imei}</span>}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            ${item.cashUnitPrice.toFixed(2)}
                            {dualPricingEnabled && <span className="text-amber-600 ml-1">/ ${cardPrice.toFixed(2)} card</span>}
                          </div>
                        </div>
                        {!item.isSerialized ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => updateQuantity(index, -1)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors" data-testid={`button-qty-minus-${index}`}>
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-semibold w-7 text-center tabular-nums">{item.quantity}</span>
                            <button onClick={() => updateQuantity(index, 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors" data-testid={`button-qty-plus-${index}`}>
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground w-7 text-center shrink-0">×1</span>
                        )}
                        <div className="text-right min-w-[52px] shrink-0">
                          <div className="text-sm font-semibold tabular-nums">${(item.cashUnitPrice * item.quantity).toFixed(2)}</div>
                        </div>
                        <button onClick={() => removeItem(index)} className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" data-testid={`button-remove-${index}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {/* Totals & Checkout */}
            <div className="p-3 border-t border-border mt-auto shrink-0 space-y-3">
              {stockWarnings.length > 0 && (
                <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Stock Warning
                  </p>
                  {stockWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-500">{w}</p>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  {/* Discount */}
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Select value={discountType} onValueChange={(v) => { setDiscountType(v as any); if (v === "none") setDiscountValue(""); }}>
                      <SelectTrigger className="h-7 w-[120px] text-xs" data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percent">Percent (%)</SelectItem>
                        <SelectItem value="fixed">Fixed ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    {discountType !== "none" && (
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          className="h-7 text-xs pr-6"
                          placeholder={discountType === "percent" ? "%" : "$"}
                          data-testid="input-discount-value"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {discountType === "percent" ? "%" : "$"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">${subtotalCash.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Discount {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                        <span className="tabular-nums">-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax {defaultTaxRate ? `(${(taxRate * 100).toFixed(2)}%)` : ""}</span>
                      <span className="tabular-nums">${cashTotals.tax.toFixed(2)}</span>
                    </div>
                    <Separator className="my-1.5" />
                    <div className="flex justify-between font-bold">
                      <span>{settings?.cashLabel || "Cash"} Total</span>
                      <span className="tabular-nums text-base" data-testid="text-cash-total">${cashTotals.total.toFixed(2)}</span>
                    </div>
                    {dualPricingEnabled && (
                      <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400">
                        <span>{settings?.cardLabel || "Card"} Total</span>
                        <span className="tabular-nums text-base" data-testid="text-card-total">${cardTotals.total.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {noStoreSelected ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                  <MapPin className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No store selected</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Select a store from the header to begin checkout</p>
                </div>
              ) : (
                <Button
                  className="w-full h-12 text-base font-semibold"
                  disabled={cart.length === 0 || stockWarnings.length > 0}
                  onClick={openCheckout}
                  data-testid="button-checkout"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Checkout
                  {cart.length > 0 && <span className="ml-2 font-mono">${cashTotals.total.toFixed(2)}</span>}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Product Catalog */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    if (filteredProducts.length === 1) {
                      addToCart(filteredProducts[0]);
                      setSearch("");
                    } else {
                      const exact = products.filter((p: any) => p.isActive).find((p: any) =>
                        p.barcode?.toLowerCase() === search.trim().toLowerCase() ||
                        p.sku?.toLowerCase() === search.trim().toLowerCase()
                      );
                      if (exact) {
                        addToCart(exact);
                        setSearch("");
                      }
                    }
                  }
                }}
                className="pl-9 h-10"
                data-testid="input-product-search"
              />
            </div>
            <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setCustomItemOpen(true)} data-testid="button-add-custom-item">
              <PenLine className="w-4 h-4 mr-1.5" />
              Custom
            </Button>
          </div>

          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryClick(null)}
              className="h-7 px-3 text-xs shrink-0"
              data-testid="button-category-all"
            >
              All
            </Button>
            {topLevelCategories.map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id || expandedParent === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryClick(cat.id)}
                className="whitespace-nowrap h-7 px-3 text-xs shrink-0"
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
                {getSubcategories(cat.id).length > 0 && <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
            ))}
          </div>
          {expandedParent && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
              <Button
                variant={selectedCategory === expandedParent ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(expandedParent)}
                className="h-6 px-2 text-xs shrink-0"
                data-testid={`button-subcategory-all-${expandedParent}`}
              >
                All {categories.find((c: any) => c.id === expandedParent)?.name}
              </Button>
              {getSubcategories(expandedParent).map((sub: any) => (
                <Button
                  key={sub.id}
                  variant={selectedCategory === sub.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCategoryClick(sub.id)}
                  className="whitespace-nowrap h-6 px-2 text-xs shrink-0"
                  data-testid={`button-subcategory-${sub.id}`}
                >
                  {sub.name}
                </Button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((product: any) => {
                  const cashPrice = product.isOpenPrice ? 0 : parseFloat(product.cashPrice || "0");
                  const cardPrice = product.isOpenPrice ? 0 : calcCardPrice(cashPrice);
                  const inCart = product.isSerialized
                    ? cart.filter(i => i.productId === product.id && i.isSerialized)
                    : cart.filter(i => i.productId === product.id && !i.isSerialized);
                  const inCartCount = inCart.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`relative text-left p-3 rounded-lg border transition-all group/card hover:border-primary/50 hover:shadow-md active:scale-[0.98] ${
                        inCartCount > 0 ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-card-border bg-card"
                      }`}
                      data-testid={`product-${product.id}`}
                    >
                      {inCartCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shadow-sm">
                          {inCartCount}
                        </div>
                      )}
                      <div className="flex items-start gap-2 mb-1.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          product.isSerialized ? "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" :
                          product.isService ? "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" :
                          "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        }`}>
                          {product.isSerialized ? <Cpu className="w-3.5 h-3.5" /> : product.isService ? <Tag className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-tight line-clamp-2">{product.name}</div>
                          {product.sku && <div className="text-[11px] text-muted-foreground mt-0.5">{product.sku}</div>}
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground/0 group-hover/card:text-primary transition-colors shrink-0" />
                      </div>
                      <div className="flex items-end justify-between mt-1">
                        <div>
                          {product.isOpenPrice ? (
                            <div className="text-xs font-medium text-amber-600">Open Price</div>
                          ) : (
                            <>
                              <div className="text-sm font-bold tabular-nums">
                                ${cashPrice.toFixed(2)}
                                {dualPricingEnabled && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">cash</span>}
                              </div>
                              {dualPricingEnabled && (
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">${cardPrice.toFixed(2)} <span className="text-[10px]">card</span></div>
                              )}
                            </>
                          )}
                        </div>
                        {!product.isService && product.trackInventory && !product.isSerialized && (
                          <Badge variant={product.quantityOnHand === 0 ? "destructive" : product.quantityOnHand <= product.lowStockThreshold ? "secondary" : "secondary"} className={`text-[10px] h-5 ${product.quantityOnHand > 0 && product.quantityOnHand <= product.lowStockThreshold ? "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400" : ""}`}>
                            {product.quantityOnHand === 0 ? "Out" : `${product.quantityOnHand} in stock`}
                          </Badge>
                        )}
                        {product.isSerialized && (
                          <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400">
                            <Cpu className="w-2.5 h-2.5 mr-0.5" />
                            Serial
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Checkout Payment Modal ── */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!checkoutMutation.isPending) setCheckoutOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-5 h-5" />
              Checkout
            </DialogTitle>
          </DialogHeader>

          {/* Customer & Store Context */}
          <div className="flex items-center gap-3 text-sm bg-muted/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : "Walk-in Customer"}</span>
            </div>
            {selectedStore && (
              <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                <Store className="w-3.5 h-3.5" />
                <span className="text-xs">{selectedStore.name}</span>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          {!checkoutPayMethod && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums" data-testid="text-checkout-total">${cashTotals.total.toFixed(2)}</p>
                {dualPricingEnabled && (
                  <p className="text-sm text-amber-600 tabular-nums">${cardTotals.total.toFixed(2)} if paying by card</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
                  {discountAmount > 0 && ` · $${discountAmount.toFixed(2)} discount`}
                </p>
              </div>
              <p className="text-sm font-medium text-center text-muted-foreground">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCheckoutPayMethod("cash")}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all"
                  data-testid="button-pay-cash"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="font-semibold">Cash</span>
                  <span className="text-lg font-bold tabular-nums">${cashTotals.total.toFixed(2)}</span>
                </button>
                <button
                  onClick={() => {
                    if (!settings?.spinEnabled || !terminalStatus?.hasTerminal) {
                      setCheckoutPayMethod("card");
                    } else {
                      setCheckoutPayMethod("card");
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all"
                  data-testid="button-pay-card"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="font-semibold">Card</span>
                  <span className="text-lg font-bold tabular-nums">${cardTotals.total.toFixed(2)}</span>
                </button>
              </div>
            </div>
          )}

          {/* Cash Payment Flow */}
          {checkoutPayMethod === "cash" && !checkoutMutation.isPending && !checkoutError && (
            <div className="space-y-4">
              <button onClick={() => setCheckoutPayMethod(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                ← Back to payment method
              </button>

              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
                <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400" data-testid="text-cash-due">${activeTotals.total.toFixed(2)}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Quick Tender</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCashTendered(activeTotals.total.toFixed(2))}
                    className="h-10 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                    data-testid="button-tender-exact"
                  >
                    Exact
                  </button>
                  {quickTenders.filter(a => a !== activeTotals.total).map(amount => (
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

              {cashTenderedNum > 0 && cashTenderedNum >= activeTotals.total && (
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-0.5">Change Due</p>
                  <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400" data-testid="text-change-due">${changeDue.toFixed(2)}</p>
                </div>
              )}

              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={cashTenderedNum < activeTotals.total || checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
                data-testid="button-confirm-cash"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirm Cash Payment
              </Button>
            </div>
          )}

          {/* Card Payment Flow */}
          {checkoutPayMethod === "card" && !checkoutMutation.isPending && !checkoutError && (
            <div className="space-y-4">
              <button onClick={() => setCheckoutPayMethod(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                ← Back to payment method
              </button>

              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Card Amount Due</p>
                <p className="text-3xl font-bold tabular-nums text-blue-700 dark:text-blue-400" data-testid="text-card-due">${activeTotals.total.toFixed(2)}</p>
                {dualPricingEnabled && subtotalCash !== subtotalCard && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Cash price: ${cashTotals.total.toFixed(2)} + {cardUpliftPercent}% surcharge: ${(activeTotals.total - cashTotals.total).toFixed(2)}</p>
                  </div>
                )}
              </div>

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
                      <span className="text-sm text-amber-700 dark:text-amber-400">No payment terminal available for this store</span>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={checkoutMutation.isPending || (settings?.spinEnabled && !terminalStatus?.hasTerminal)}
                onClick={() => checkoutMutation.mutate()}
                data-testid="button-confirm-card"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {settings?.spinEnabled && terminalStatus?.hasTerminal ? "Send to Terminal" : "Process Card Payment"}
              </Button>
            </div>
          )}

          {/* Processing State */}
          {checkoutMutation.isPending && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-base font-semibold">
                {checkoutPayMethod === "card" && settings?.spinEnabled ? "Waiting for terminal..." : "Processing..."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {checkoutPayMethod === "card" && settings?.spinEnabled
                  ? "Customer should tap, insert, or swipe their card"
                  : "Completing transaction..."
                }
              </p>
            </div>
          )}

          {/* Checkout Error State */}
          {checkoutError && !checkoutMutation.isPending && (() => {
            const t = checkoutError.type || "declined";
            const isAlreadyCompleted = t === "already_completed" || t === "duplicate_pending";
            const isAmber = t === "cancelled" || t === "timeout" || t === "terminal_busy";
            const borderColor = isAlreadyCompleted ? "border-amber-200 dark:border-amber-800" : isAmber ? "border-amber-200 dark:border-amber-800" : "border-red-200 dark:border-red-800";
            const bgColor = isAlreadyCompleted ? "bg-amber-50 dark:bg-amber-950/30" : isAmber ? "bg-amber-50 dark:bg-amber-950/30" : "bg-red-50 dark:bg-red-950/30";
            const iconBg = isAlreadyCompleted ? "bg-amber-100 dark:bg-amber-900/40" : isAmber ? "bg-amber-100 dark:bg-amber-900/40" : "bg-red-100 dark:bg-red-900/40";
            const iconColor = isAlreadyCompleted ? "text-amber-600" : isAmber ? "text-amber-600" : "text-red-600";
            const textColor = isAlreadyCompleted ? "text-amber-800 dark:text-amber-300" : isAmber ? "text-amber-800 dark:text-amber-300" : "text-red-800 dark:text-red-300";
            const detailColor = isAlreadyCompleted ? "text-amber-600 dark:text-amber-400" : isAmber ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
            let subtitle = "";
            if (isAlreadyCompleted) subtitle = "Check your recent sales before attempting another transaction";
            else if (t === "cancelled") subtitle = "The transaction was cancelled at the terminal";
            else if (t === "timeout") subtitle = "The terminal did not respond in time";
            else if (t === "terminal_error") subtitle = "Check that the terminal is powered on and connected";
            else if (t === "comm_error") subtitle = "Could not communicate with the payment terminal";
            else if (t === "terminal_busy") subtitle = "Another transaction may be in progress";
            else if (t === "declined") subtitle = "The card was not accepted";

            const icon = isAlreadyCompleted ? <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
              : t === "cancelled" ? <X className={`w-6 h-6 ${iconColor}`} />
              : t === "timeout" ? <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
              : t === "terminal_busy" ? <Loader2 className={`w-6 h-6 ${iconColor}`} />
              : (t === "terminal_error" || t === "comm_error") ? <WifiOff className={`w-6 h-6 ${iconColor}`} />
              : <CreditCard className={`w-6 h-6 ${iconColor}`} />;

            return (
              <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-4 text-center`} data-testid="checkout-error">
                <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-3`}>
                  {icon}
                </div>
                <p className={`text-base font-semibold ${textColor}`}>{checkoutError.message}</p>
                {subtitle && <p className={`text-xs ${detailColor} mt-1`}>{subtitle}</p>}
                <div className="flex gap-2 justify-center mt-4">
                  {isAlreadyCompleted ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setCheckoutError(null); setCheckoutOpen(false); setCheckoutPayMethod(null); setCheckoutIdempotencyKey(crypto.randomUUID()); }} data-testid="button-error-dismiss">
                        Dismiss
                      </Button>
                      <Button size="sm" onClick={() => { window.location.href = "/app/sales"; }} data-testid="button-error-view-sales">
                        View Sales
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setCheckoutError(null); setCheckoutPayMethod(null); }} data-testid="button-error-change-method">
                        Change Method
                      </Button>
                      <Button size="sm" onClick={() => { setCheckoutError(null); checkoutMutation.mutate(); }} data-testid="button-error-retry">
                        Try Again
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Serialized Unit Selection Dialog */}
      <Dialog open={!!unitSelectProductId} onOpenChange={(open) => { if (!open) { setUnitSelectProductId(null); setUnitSelectProductName(""); setUnitSearch(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Select Unit - {unitSelectProductName}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by serial number or IMEI..."
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              className="pl-9"
              data-testid="input-unit-search"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {unitsLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No available units found</p>
                <p className="text-xs">All units may be sold or reserved</p>
              </div>
            ) : (
              filteredUnits.map((unit: any) => {
                const alreadyInCart = cart.some(i => i.inventoryUnitId === unit.id);
                return (
                  <button
                    key={unit.id}
                    onClick={() => addSerializedUnit(unit)}
                    disabled={alreadyInCart}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors border border-transparent ${
                      alreadyInCart
                        ? "opacity-50 cursor-not-allowed bg-muted/30"
                        : "hover:bg-muted hover:border-border"
                    }`}
                    data-testid={`unit-option-${unit.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                          {unit.serialNumber && <span data-testid={`text-unit-serial-${unit.id}`}>S/N: {unit.serialNumber}</span>}
                          {unit.imei && <span data-testid={`text-unit-imei-${unit.id}`}>IMEI: {unit.imei}</span>}
                          {!unit.serialNumber && !unit.imei && <span className="text-muted-foreground">Unit #{unit.id}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getConditionLabel(unit.condition)}
                          {unit.acquisitionCost && <span> · Cost: ${parseFloat(unit.acquisitionCost).toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {alreadyInCart ? (
                          <Badge variant="secondary" className="text-xs">In Cart</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Available</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openPriceProduct} onOpenChange={(open) => { if (!open) { setOpenPriceProduct(null); setOpenPriceValue(""); setOpenPriceCost(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Enter Price — {openPriceProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sale Price ($) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={openPriceValue}
                onChange={(e) => setOpenPriceValue(e.target.value)}
                autoFocus
                data-testid="input-open-price"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmOpenPriceItem(); } }}
              />
              {openPriceProduct?.minOpenPrice || openPriceProduct?.maxOpenPrice ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {openPriceProduct.minOpenPrice && `Min: $${parseFloat(openPriceProduct.minOpenPrice).toFixed(2)}`}
                  {openPriceProduct.minOpenPrice && openPriceProduct.maxOpenPrice && " · "}
                  {openPriceProduct.maxOpenPrice && `Max: $${parseFloat(openPriceProduct.maxOpenPrice).toFixed(2)}`}
                </p>
              ) : null}
            </div>
            {openPriceProduct?.costCalculationMode === "manual_cost_at_sale" && (
              <div>
                <Label>Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={openPriceCost}
                  onChange={(e) => setOpenPriceCost(e.target.value)}
                  data-testid="input-open-price-cost"
                />
              </div>
            )}
            {openPriceValue && parseFloat(openPriceValue) > 0 && openPriceProduct?.costCalculationMode !== "manual_cost_at_sale" && (() => {
              const amt = parseFloat(openPriceValue);
              const mode = openPriceProduct?.costCalculationMode || "fixed_cost";
              let cost = 0, profit = 0;
              if (mode === "fixed_cost") {
                cost = parseFloat(openPriceProduct?.fixedCost || openPriceProduct?.cost || "0");
                profit = amt - cost;
              } else if (mode === "profit_percent_of_sale") {
                const pct = parseFloat(openPriceProduct?.profitPercent || "0");
                profit = Math.round(amt * pct / 100 * 100) / 100;
                cost = amt - profit;
              } else if (mode === "flat_profit") {
                profit = parseFloat(openPriceProduct?.flatProfitAmount || "0");
                cost = amt - profit;
              }
              return (
                <div className="bg-muted/50 rounded p-2 text-xs space-y-0.5">
                  <div className="flex justify-between"><span>Cost:</span><span className="font-medium">${Math.max(0, cost).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Profit:</span><span className="font-medium text-green-600">${Math.max(0, profit).toFixed(2)}</span></div>
                </div>
              );
            })()}
            <Button className="w-full" onClick={confirmOpenPriceItem} data-testid="button-confirm-open-price">
              Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Search Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search by name, email, phone..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            data-testid="input-customer-search"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCustomers.map((c: any) => (
              <button
                key={c.id}
                onClick={() => { setCustomerId(c.id); setCustomerDialogOpen(false); setCustomerSearch(""); }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                data-testid={`customer-option-${c.id}`}
              >
                <div className="text-sm font-medium">{c.firstName} {c.lastName}</div>
                <div className="text-xs text-muted-foreground">{c.email || c.phone || ""}</div>
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No customers found</p>
            )}
          </div>
          <Separator />
          <Button variant="outline" className="w-full" onClick={() => { setCustomerDialogOpen(false); setCreateCustOpen(true); }} data-testid="button-create-customer-from-pos">
            <UserPlus className="w-4 h-4 mr-2" />
            Create New Customer
          </Button>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createCustOpen} onOpenChange={setCreateCustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Quick Create Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={newCustFirst} onChange={(e) => setNewCustFirst(e.target.value)} data-testid="input-new-cust-first" />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={newCustLast} onChange={(e) => setNewCustLast(e.target.value)} data-testid="input-new-cust-last" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} data-testid="input-new-cust-email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} data-testid="input-new-cust-phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCustOpen(false)}>Cancel</Button>
            <Button
              disabled={!newCustFirst.trim() || !newCustLast.trim() || createCustomerMutation.isPending}
              onClick={() => createCustomerMutation.mutate()}
              data-testid="button-confirm-create-customer"
            >
              {createCustomerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create & Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      <Dialog open={customItemOpen} onOpenChange={setCustomItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5" />
              Add Custom Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Description *</Label>
              <Input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="e.g. Screen protector install" data-testid="input-custom-desc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <Input type="number" min="0.01" step="0.01" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="0.00" data-testid="input-custom-amount" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="1" step="1" value={customQty} onChange={(e) => setCustomQty(e.target.value)} data-testid="input-custom-qty" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Taxable</Label>
              <Switch checked={customTaxable} onCheckedChange={setCustomTaxable} data-testid="switch-custom-taxable" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomItemOpen(false)}>Cancel</Button>
            <Button onClick={addCustomItem} disabled={!customDesc.trim() || !customAmount} data-testid="button-add-custom-confirm">
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Receipt Actions */}
      <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-1" data-testid="text-sale-success">Sale Complete!</h2>
            <p className="text-muted-foreground text-sm mb-4">Transaction processed successfully</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sale #</span><span className="font-medium">{successDialog?.saleNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-lg">${successDialog?.finalTotal}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium capitalize">{successDialog?.paymentMethod === "card" ? "Card" : "Cash"}</span></div>
              {dualPricingEnabled && successDialog?.pricingMode && (
                <div className="flex justify-between"><span className="text-muted-foreground">Pricing</span><span className="font-medium">{successDialog.pricingMode === "card" ? "Card Rate" : "Cash Rate"}</span></div>
              )}
              {successDialog?.cardDetails?.cardBrand && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card</span>
                  <span className="font-medium">{successDialog.cardDetails.cardBrand} ****{successDialog.cardDetails.cardLast4}</span>
                </div>
              )}
              {successDialog?.cardDetails?.entryMode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry</span>
                  <span className="font-medium capitalize">{successDialog.cardDetails.entryMode}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handlePrintReceipt} data-testid="button-print-receipt">
                <Printer className="w-4 h-4 mr-1" />
                Print Receipt
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={resendReceiptMutation.isPending}
                onClick={() => {
                  if (successDialog?.customerEmail && successDialog?.saleId) {
                    resendReceiptMutation.mutate({ saleId: successDialog.saleId });
                  } else {
                    setManualEmailOpen(true);
                  }
                }}
                data-testid="button-email-receipt"
              >
                {resendReceiptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
                Email Receipt
              </Button>
            </div>
            {successDialog?.customerEmail && (
              <p className="text-xs text-muted-foreground mt-1">Will send to {successDialog.customerEmail}</p>
            )}
            <Button className="w-full mt-4" onClick={() => setSuccessDialog(null)} data-testid="button-new-sale">
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                if (successDialog?.saleId && manualEmail.trim()) {
                  resendReceiptMutation.mutate({ saleId: successDialog.saleId, email: manualEmail.trim() });
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
