import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MerchantLayout from "@/components/merchant-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, Building, Store, CreditCard, Mail, Receipt, Loader2, Plus, Edit, DollarSign, AlertCircle, CheckCircle, Clock, ShieldAlert, AlertTriangle, CalendarClock, Upload, Trash2, Image, Star, ToggleLeft, FileText, Wifi, Info, MapPin, Users, Settings as SettingsIcon, Percent } from "lucide-react";
import MerchantTerminalsContent from "./terminals";
import { EmailTemplatesContent } from "./email-templates";
import { EmployeesContent } from "./employees";
import { useAuth } from "@/hooks/use-auth";

const US_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time (America/New_York)",
  "America/Chicago": "Central Time (America/Chicago)",
  "America/Denver": "Mountain Time (America/Denver)",
  "America/Los_Angeles": "Pacific Time (America/Los_Angeles)",
  "America/Phoenix": "Arizona Time (America/Phoenix)",
  "America/Anchorage": "Alaska Time (America/Anchorage)",
  "Pacific/Honolulu": "Hawaii Time (Pacific/Honolulu)",
};

function humanizeBillingStatus(raw: string | undefined | null): string {
  if (!raw) return "Pending setup";
  const map: Record<string, string> = {
    pending_setup: "Pending setup",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    retrying: "Retrying",
    failed: "Failed",
    requires_card_update: "Requires card update",
    current: "Current",
  };
  return map[raw] || raw.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function ScopeLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-normal ml-2">
      <Info className="w-3 h-3" />
      {text}
    </span>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.merchantRole === "owner";
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/merchant/settings"] });
  const { data: stores = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/stores"] });
  const { data: storeThresholds } = useQuery<any[]>({ queryKey: ["/api/merchant/billing/store-thresholds"], enabled: isOwner });

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");

  const [dualPricingEnabled, setDualPricingEnabled] = useState(false);
  const [cardUpliftPercent, setCardUpliftPercent] = useState("3.50");
  const [cashLabel, setCashLabel] = useState("Cash");
  const [cardLabel, setCardLabel] = useState("Card");
  const [spinEnabled, setSpinEnabled] = useState(false);
  const [taxLabor, setTaxLabor] = useState(false);
  const [ticketCommissionType, setTicketCommissionType] = useState("disabled");
  const [ticketCommissionValue, setTicketCommissionValue] = useState("0.00");

  const [emailReceiptsEnabled, setEmailReceiptsEnabled] = useState(true);
  const [repairStatusEmailsEnabled, setRepairStatusEmailsEnabled] = useState(true);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [defaultEstimateTerms, setDefaultEstimateTerms] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const [rcptShowLogo, setRcptShowLogo] = useState(true);
  const [rcptShowBusinessName, setRcptShowBusinessName] = useState(true);
  const [rcptShowStoreName, setRcptShowStoreName] = useState(true);
  const [rcptShowAddress, setRcptShowAddress] = useState(true);
  const [rcptShowPhone, setRcptShowPhone] = useState(true);
  const [rcptShowEmailWebsite, setRcptShowEmailWebsite] = useState(false);
  const [rcptShowCustomerName, setRcptShowCustomerName] = useState(true);
  const [rcptShowCashierName, setRcptShowCashierName] = useState(true);
  const [rcptShowTicketNumber, setRcptShowTicketNumber] = useState(true);
  const [rcptShowSerialImei, setRcptShowSerialImei] = useState(true);
  const [rcptShowPricingMode, setRcptShowPricingMode] = useState(true);
  const [rcptShowDiscountLine, setRcptShowDiscountLine] = useState(true);
  const [rcptShowTaxLine, setRcptShowTaxLine] = useState(true);
  const [rcptFooterText, setRcptFooterText] = useState("Thank you for your business!");
  const [rcptReturnPolicy, setRcptReturnPolicy] = useState("");
  const [rcptWarrantyText, setRcptWarrantyText] = useState("");

  const [editStore, setEditStore] = useState<any>(null);
  const [createStoreDialog, setCreateStoreDialog] = useState(false);
  const [stationStoreId, setStationStoreId] = useState<number | null>(null);
  const [createStationDialog, setCreateStationDialog] = useState(false);
  const [createTerminalVal, setCreateTerminalVal] = useState("none");
  const [editStation, setEditStation] = useState<any>(null);
  const [editTerminalVal, setEditTerminalVal] = useState("none");
  const [editActiveVal, setEditActiveVal] = useState(true);
  const [taxRateDialog, setTaxRateDialog] = useState(false);
  const [editTaxRate, setEditTaxRate] = useState<any>(null);
  const [newTaxDefault, setNewTaxDefault] = useState(false);
  const [updateCardDialog, setUpdateCardDialog] = useState(false);

  const { data: billingData, isLoading: billingLoading } = useQuery<any>({ queryKey: ["/api/merchant/billing"] });
  const { data: onboardingStatus } = useQuery<any>({ queryKey: ["/api/merchant/onboarding/status"] });
  const { data: billingHistory = [], isLoading: historyLoading } = useQuery<any[]>({ queryKey: ["/api/merchant/billing/transactions"] });
  const [expandedTxn, setExpandedTxn] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setBusinessName(data.tenant?.businessName || "");
      setContactName(data.tenant?.contactName || "");
      setPrimaryEmail(data.tenant?.primaryEmail || "");
      setPrimaryPhone(data.tenant?.primaryPhone || "");
      setDualPricingEnabled(data.settings?.dualPricingEnabled || false);
      setCardUpliftPercent(data.settings?.cardUpliftPercent || "3.50");
      setCashLabel(data.settings?.cashLabel || "Cash");
      setCardLabel(data.settings?.cardLabel || "Card");
      setSpinEnabled(data.settings?.spinEnabled || false);
      setTaxLabor(data.settings?.taxLabor ?? false);
      setTicketCommissionType(data.settings?.ticketCommissionType ?? "disabled");
      setTicketCommissionValue(data.settings?.ticketCommissionValue ?? "0.00");
      setEmailReceiptsEnabled(data.settings?.emailReceiptsEnabled ?? true);
      setRepairStatusEmailsEnabled(data.settings?.repairStatusEmailsEnabled ?? true);
      setSenderName(data.settings?.senderName || "");
      setSenderEmail(data.settings?.senderEmail || "");
      setLogoUrl(data.settings?.logoUrl || "");
      setFooterText(data.settings?.footerText || "");
      setDefaultEstimateTerms(data.settings?.defaultEstimateTerms || "");
      setRcptShowLogo(data.settings?.receiptShowLogo ?? true);
      setRcptShowBusinessName(data.settings?.receiptShowBusinessName ?? true);
      setRcptShowStoreName(data.settings?.receiptShowStoreName ?? true);
      setRcptShowAddress(data.settings?.receiptShowAddress ?? true);
      setRcptShowPhone(data.settings?.receiptShowPhone ?? true);
      setRcptShowEmailWebsite(data.settings?.receiptShowEmailWebsite ?? false);
      setRcptShowCustomerName(data.settings?.receiptShowCustomerName ?? true);
      setRcptShowCashierName(data.settings?.receiptShowCashierName ?? true);
      setRcptShowTicketNumber(data.settings?.receiptShowTicketNumber ?? true);
      setRcptShowSerialImei(data.settings?.receiptShowSerialImei ?? true);
      setRcptShowPricingMode(data.settings?.receiptShowPricingMode ?? true);
      setRcptShowDiscountLine(data.settings?.receiptShowDiscountLine ?? true);
      setRcptShowTaxLine(data.settings?.receiptShowTaxLine ?? true);
      setRcptFooterText(data.settings?.receiptFooterText ?? "Thank you for your business!");
      setRcptReturnPolicy(data.settings?.receiptReturnPolicy ?? "");
      setRcptWarrantyText(data.settings?.receiptWarrantyText ?? "");
    }
  }, [data]);

  const paymentDirty = data ? (
    dualPricingEnabled !== (data.settings?.dualPricingEnabled || false) ||
    cardUpliftPercent !== (data.settings?.cardUpliftPercent || "3.50") ||
    cashLabel !== (data.settings?.cashLabel || "Cash") ||
    cardLabel !== (data.settings?.cardLabel || "Card") ||
    ticketCommissionType !== (data.settings?.ticketCommissionType ?? "disabled") ||
    ticketCommissionValue !== (data.settings?.ticketCommissionValue ?? "0.00")
  ) : false;

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiRequest("PATCH", "/api/merchant/settings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveStoreMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/merchant/stores/${editStore.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
      setEditStore(null);
      toast({ title: "Store updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/merchant/stores", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
      setCreateStoreDialog(false);
      toast({ title: "Store created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: stationsList = [], isLoading: stationsLoading } = useQuery<any[]>({
    queryKey: [`/api/merchant/stations?storeId=${stationStoreId}`],
    enabled: !!stationStoreId,
  });

  const { data: terminalsList = [] } = useQuery<any[]>({
    queryKey: ["/api/merchant/spin/terminals"],
  });

  const createStationMutation = useMutation({
    mutationFn: async (stationData: { name: string; storeId: number; defaultTerminalId?: number | null }) => {
      await apiRequest("POST", "/api/merchant/stations", stationData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/merchant/stations?storeId=${stationStoreId}`] });
      setCreateStationDialog(false);
      toast({ title: "Station created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateStationMutation = useMutation({
    mutationFn: async ({ id, ...stationData }: { id: number; name?: string; defaultTerminalId?: number | null; isActive?: boolean }) => {
      await apiRequest("PATCH", `/api/merchant/stations/${id}`, stationData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/merchant/stations?storeId=${stationStoreId}`] });
      setEditStation(null);
      toast({ title: "Station updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteStationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/merchant/stations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/merchant/stations?storeId=${stationStoreId}`] });
      toast({ title: "Station deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTaxRateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/merchant/tax-rates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
      setTaxRateDialog(false);
      toast({ title: "Tax rate created" });
    },
  });

  const updateTaxRateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await apiRequest("PATCH", `/api/merchant/tax-rates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
      setEditTaxRate(null);
      toast({ title: "Tax rate updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const res = await apiRequest("POST", "/api/merchant/billing/update-card", cardData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/billing"] });
      setUpdateCardDialog(false);
      toast({ title: "Card updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSaveBusiness = () => {
    saveMutation.mutate({
      tenantData: { businessName, contactName, primaryEmail, primaryPhone },
    });
  };

  const handleSavePayment = () => {
    saveMutation.mutate({
      settingsData: { dualPricingEnabled, cardUpliftPercent, cashLabel, cardLabel, ticketCommissionType, ticketCommissionValue },
    });
  };

  const handleSaveEmail = () => {
    saveMutation.mutate({
      settingsData: { emailReceiptsEnabled, repairStatusEmailsEnabled, senderName, senderEmail, footerText, defaultEstimateTerms },
    });
  };

  if (isLoading) {
    return <MerchantLayout><div className="space-y-6"><h1 className="text-2xl font-bold">Settings</h1><Skeleton className="h-64" /><Skeleton className="h-48" /></div></MerchantLayout>;
  }

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your business configuration</p>
          </div>
        </div>

        {onboardingStatus?.billingLocked && (
          <Card className="border-destructive bg-destructive/5" data-testid="banner-billing-locked">
            <CardContent className="flex items-start gap-4 py-5">
              <ShieldAlert className="w-8 h-8 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-destructive">Account Suspended — Payment Required</h3>
                <p className="text-sm text-muted-foreground">
                  Your account has been locked due to a failed payment of{" "}
                  <span className="font-semibold text-foreground">${parseFloat(onboardingStatus.outstandingBalance || "0").toFixed(2)}</span>.
                  Please update your billing card below to restore access.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const billingTab = document.querySelector('[data-testid="tab-billing"]') as HTMLElement;
                    if (billingTab) billingTab.click();
                    setUpdateCardDialog(true);
                  }}
                  data-testid="button-update-card-locked"
                >
                  <CreditCard className="w-4 h-4 mr-2" /> Update Payment Card
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {onboardingStatus?.paymentStatus && ["retrying", "failed", "past_due", "requires_card_update"].includes(onboardingStatus.paymentStatus) && !onboardingStatus.billingLocked && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10" data-testid="banner-billing-warning">
            <CardContent className="flex items-start gap-4 py-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-yellow-800 dark:text-yellow-300">Payment Issue</h3>
                <p className="text-sm text-muted-foreground">
                  Your last billing payment failed. Outstanding balance:{" "}
                  <span className="font-semibold text-foreground">${parseFloat(onboardingStatus.outstandingBalance || "0").toFixed(2)}</span>.
                  Please update your card to avoid account suspension.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const billingTab = document.querySelector('[data-testid="tab-billing"]') as HTMLElement;
                  if (billingTab) billingTab.click();
                  setUpdateCardDialog(true);
                }}
                data-testid="button-update-card-warning"
              >
                Update Card
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || (onboardingStatus?.billingLocked ? "billing" : "business")} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-0.5 p-1.5">
            <TabsTrigger value="business"><Building className="w-3.5 h-3.5 mr-1.5" />Business</TabsTrigger>
            <TabsTrigger value="stores"><Store className="w-3.5 h-3.5 mr-1.5" />Stores</TabsTrigger>
            <TabsTrigger value="payment"><Percent className="w-3.5 h-3.5 mr-1.5" />Pricing</TabsTrigger>
            <TabsTrigger value="tax"><DollarSign className="w-3.5 h-3.5 mr-1.5" />Tax</TabsTrigger>
            <TabsTrigger value="email"><Mail className="w-3.5 h-3.5 mr-1.5" />Email</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates"><FileText className="w-3.5 h-3.5 mr-1.5" />Templates</TabsTrigger>
            <TabsTrigger value="receipts" data-testid="tab-receipts"><Receipt className="w-3.5 h-3.5 mr-1.5" />Receipts</TabsTrigger>
            <TabsTrigger value="employees" data-testid="tab-employees"><Users className="w-3.5 h-3.5 mr-1.5" />Employees</TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing"><CreditCard className="w-3.5 h-3.5 mr-1.5" />Billing</TabsTrigger>
            <TabsTrigger value="terminals" data-testid="tab-terminals"><Wifi className="w-3.5 h-3.5 mr-1.5" />Terminals</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Building className="w-4 h-4" /> Business Information<ScopeLabel text="Applies to all stores" /></CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Your business identity used across receipts, emails, and account settings.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Business Name</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} data-testid="input-business-name" /></div>
                  <div><Label>Contact Name</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
                  <div><Label>Email</Label><Input value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} type="email" /></div>
                  <div><Label>Phone</Label><Input value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} /></div>
                </div>
                <Button onClick={handleSaveBusiness} disabled={saveMutation.isPending} data-testid="button-save-business">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores">
            <div className="space-y-4">
            <Card className="border-card-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4" /> Store Locations<ScopeLabel text="Configured per store" /></CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Manage your physical locations, addresses, and station assignments.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setCreateStoreDialog(true)} data-testid="button-add-store">
                  <Plus className="w-4 h-4 mr-1" /> Add Store
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Timezone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.stores || stores).map((s: any) => (
                      <TableRow key={s.id} data-testid={`row-store-${s.id}`}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{[s.address, s.city, s.state, s.zip].filter(Boolean).join(", ")}</TableCell>
                        <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.timezone ? (TIMEZONE_LABELS[s.timezone] || s.timezone) : "—"}</TableCell>
                        <TableCell><Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditStore(s)} data-testid={`button-edit-store-${s.id}`}><Edit className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Checkout Stations<ScopeLabel text="Per-store checkout positions" /></CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Define checkout stations for stores with multiple registers. Each station can have its own default terminal.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label className="text-sm shrink-0">Select Store</Label>
                  <Select value={stationStoreId ? String(stationStoreId) : ""} onValueChange={v => setStationStoreId(v ? parseInt(v) : null)}>
                    <SelectTrigger className="w-[220px]" data-testid="select-station-store">
                      <SelectValue placeholder="Choose a store..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.stores || stores).map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)} data-testid={`select-station-store-${s.id}`}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {stationStoreId && (
                    <Button size="sm" variant="outline" onClick={() => setCreateStationDialog(true)} data-testid="button-add-station">
                      <Plus className="w-4 h-4 mr-1" /> Add Station
                    </Button>
                  )}
                </div>

                {stationStoreId && (
                  stationsLoading ? (
                    <Skeleton className="h-24" />
                  ) : stationsList.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                      No stations configured for this store. Add a station to define checkout positions.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Station Name</TableHead>
                          <TableHead>Default Terminal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stationsList.map((st: any) => {
                          const storeTerminals = terminalsList.filter((t: any) => t.storeId === stationStoreId);
                          const terminal = storeTerminals.find((t: any) => t.id === st.defaultTerminalId);
                          return (
                            <TableRow key={st.id} data-testid={`row-station-${st.id}`}>
                              <TableCell className="font-medium">{st.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{terminal ? terminal.deviceName : <span className="italic">None</span>}</TableCell>
                              <TableCell><Badge variant={st.isActive ? "default" : "secondary"}>{st.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                              <TableCell className="text-right flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => { setEditStation(st); setEditTerminalVal(st.defaultTerminalId ? String(st.defaultTerminalId) : "none"); setEditActiveVal(st.isActive !== false); }} data-testid={`button-edit-station-${st.id}`}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this station?")) deleteStationMutation.mutate(st.id); }} data-testid={`button-delete-station-${st.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )
                )}
              </CardContent>
            </Card>
            </div>

            <Dialog open={createStationDialog} onOpenChange={(open) => { setCreateStationDialog(open); if (!open) setCreateTerminalVal("none"); }}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Station</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createStationMutation.mutate({
                    name: fd.get("name") as string,
                    storeId: stationStoreId!,
                    defaultTerminalId: createTerminalVal && createTerminalVal !== "none" ? parseInt(createTerminalVal) : null,
                  });
                }} className="space-y-4">
                  <div>
                    <Label>Station Name *</Label>
                    <Input name="name" required placeholder="e.g., Front Counter" data-testid="input-station-name" />
                  </div>
                  <div>
                    <Label>Default Terminal</Label>
                    <Select value={createTerminalVal} onValueChange={setCreateTerminalVal}>
                      <SelectTrigger data-testid="select-station-terminal"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {terminalsList.filter((t: any) => t.storeId === stationStoreId).map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)} data-testid={`select-station-terminal-${t.id}`}>{t.deviceName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={createStationMutation.isPending} data-testid="button-save-station">
                    {createStationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Create Station
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!editStation} onOpenChange={(open) => { if (!open) { setEditStation(null); setEditTerminalVal("none"); setEditActiveVal(true); } }}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Edit Station</DialogTitle></DialogHeader>
                {editStation && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    updateStationMutation.mutate({
                      id: editStation.id,
                      name: fd.get("name") as string,
                      defaultTerminalId: editTerminalVal && editTerminalVal !== "none" ? parseInt(editTerminalVal) : null,
                      isActive: editActiveVal,
                    });
                  }} className="space-y-4">
                    <div>
                      <Label>Station Name *</Label>
                      <Input name="name" required defaultValue={editStation.name} data-testid="input-edit-station-name" />
                    </div>
                    <div>
                      <Label>Default Terminal</Label>
                      <Select value={editTerminalVal} onValueChange={setEditTerminalVal}>
                        <SelectTrigger data-testid="select-edit-station-terminal"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {terminalsList.filter((t: any) => t.storeId === stationStoreId).map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)} data-testid={`select-edit-station-terminal-${t.id}`}>{t.deviceName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="stationActive" checked={editActiveVal} onCheckedChange={setEditActiveVal} />
                      <Label htmlFor="stationActive">Active</Label>
                    </div>
                    <Button type="submit" disabled={updateStationMutation.isPending} data-testid="button-update-station">
                      {updateStationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="payment">
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pricing<ScopeLabel text="Applies to all stores" /></CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Configure how prices display at the register, on receipts, and in customer emails.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">Cash / Card Dual Pricing</div>
                    <div className="text-sm text-muted-foreground">Display a cash price and a separate card price at checkout. The card price includes an uplift to offset processing fees.</div>
                  </div>
                  <Switch checked={dualPricingEnabled} onCheckedChange={setDualPricingEnabled} data-testid="switch-dual-pricing" />
                </div>
                {dualPricingEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label>Card Uplift (%)</Label>
                        <Input
                          value={cardUpliftPercent}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || (/^\d*\.?\d{0,2}$/.test(val) && parseFloat(val) <= 10)) {
                              setCardUpliftPercent(val);
                            }
                          }}
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          placeholder="3.50"
                          data-testid="input-uplift"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Percentage added to the base price when a customer pays by card (max 10%)</p>
                      </div>
                      <div>
                        <Label>Cash Price Label</Label>
                        <Input value={cashLabel} onChange={(e) => setCashLabel(e.target.value)} placeholder="Cash" data-testid="input-cash-label" />
                        <p className="text-xs text-muted-foreground mt-1">Shown at POS and on receipts</p>
                      </div>
                      <div>
                        <Label>Card Price Label</Label>
                        <Input value={cardLabel} onChange={(e) => setCardLabel(e.target.value)} placeholder="Card" data-testid="input-card-label" />
                        <p className="text-xs text-muted-foreground mt-1">Shown at POS and on receipts</p>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <span className="font-medium">Preview:</span> A $100.00 item →{" "}
                      <span className="text-emerald-600 font-medium">${(100).toFixed(2)} {cashLabel || "Cash"}</span>{" / "}
                      <span className="text-amber-600 font-medium">${(100 * (1 + parseFloat(cardUpliftPercent || "0") / 100)).toFixed(2)} {cardLabel || "Card"}</span>
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Repair Ticket Commission</h3>
                  <p className="text-sm text-muted-foreground mb-3">Automatically calculate commission for the employee who closes a repair ticket. Commission is based on the final payment only — deposits do not generate commission.</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Commission Mode</Label>
                      <Select value={ticketCommissionType} onValueChange={setTicketCommissionType}>
                        <SelectTrigger data-testid="select-ticket-commission-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Off — No commission on tickets</SelectItem>
                          <SelectItem value="flat_amount">Fixed Amount — Same dollar amount per ticket</SelectItem>
                          <SelectItem value="percent_of_profit">Percentage of Profit — Based on ticket profit margin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ticketCommissionType !== "disabled" && (
                      <div>
                        <Label>{ticketCommissionType === "flat_amount" ? "Amount per Ticket ($)" : "Profit Percentage (%)"}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={ticketCommissionType === "percent_of_profit" ? "100" : undefined}
                          value={ticketCommissionValue}
                          onChange={(e) => setTicketCommissionValue(e.target.value)}
                          placeholder={ticketCommissionType === "flat_amount" ? "15.00" : "10"}
                          data-testid="input-ticket-commission-value"
                        />
                        {ticketCommissionType === "percent_of_profit" && (
                          <p className="text-xs text-muted-foreground mt-1">Profit = final payment − parts cost − internal costs. Commission is calculated on this amount.</p>
                        )}
                        {ticketCommissionType === "flat_amount" && (
                          <p className="text-xs text-muted-foreground mt-1">This amount is paid per completed ticket regardless of the repair total.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const uplift = parseFloat(cardUpliftPercent || "0");
                    if (dualPricingEnabled && (isNaN(uplift) || uplift < 0 || uplift > 10)) {
                      toast({ title: "Invalid uplift", description: "Card uplift must be between 0% and 10%.", variant: "destructive" });
                      return;
                    }
                    if (dualPricingEnabled && !cashLabel.trim()) {
                      toast({ title: "Label required", description: "Cash price label cannot be blank.", variant: "destructive" });
                      return;
                    }
                    if (dualPricingEnabled && !cardLabel.trim()) {
                      toast({ title: "Label required", description: "Card price label cannot be blank.", variant: "destructive" });
                      return;
                    }
                    if (ticketCommissionType !== "disabled") {
                      const commVal = parseFloat(ticketCommissionValue || "0");
                      if (isNaN(commVal) || commVal <= 0) {
                        toast({ title: "Invalid commission", description: "Commission value must be greater than zero.", variant: "destructive" });
                        return;
                      }
                    }
                    handleSavePayment();
                  }}
                  disabled={saveMutation.isPending || !paymentDirty}
                  data-testid="button-save-payment"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Pricing Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <Card className="border-card-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Tax Rates<ScopeLabel text="Applies to all stores" /></CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Define tax rates applied to sales and repair invoices.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTaxRateDialog(true)} data-testid="button-add-tax-rate">
                  <Plus className="w-4 h-4 mr-1" /> Add Rate
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.taxRates || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tax rates configured</TableCell>
                      </TableRow>
                    ) : (data?.taxRates || []).map((rate: any) => (
                      <TableRow key={rate.id} data-testid={`row-tax-rate-${rate.id}`}>
                        <TableCell className="font-medium">{rate.name}</TableCell>
                        <TableCell>{(parseFloat(rate.rate) * 100).toFixed(2)}%</TableCell>
                        <TableCell>{rate.isDefault ? <Badge variant="default" className="text-xs">Default</Badge> : "—"}</TableCell>
                        <TableCell><Badge variant={rate.isActive ? "default" : "secondary"}>{rate.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!rate.isDefault && rate.isActive && (
                              <Button variant="ghost" size="sm" title="Set as default"
                                onClick={() => updateTaxRateMutation.mutate({ id: rate.id, isDefault: true })}
                                data-testid={`button-default-tax-${rate.id}`}
                              >
                                <Star className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" title={rate.isActive ? "Deactivate" : "Reactivate"}
                              onClick={() => updateTaxRateMutation.mutate({ id: rate.id, isActive: !rate.isActive })}
                              data-testid={`button-toggle-tax-${rate.id}`}
                            >
                              <ToggleLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditTaxRate(rate)} data-testid={`button-edit-tax-${rate.id}`}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="border-card-border mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Tax Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">Tax Repair Labor</div>
                    <div className="text-sm text-muted-foreground">Apply sales tax to repair labor in addition to parts</div>
                  </div>
                  <Switch checked={taxLabor} onCheckedChange={setTaxLabor} data-testid="switch-tax-labor" />
                </div>
                <Button onClick={() => saveMutation.mutate({ settingsData: { taxLabor } })} disabled={saveMutation.isPending} data-testid="button-save-tax-options">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Tax Options
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Email Settings<ScopeLabel text="Applies to all stores" /></CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Control automatic emails, sender identity, estimate terms, and footer branding.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">Email Receipts</div>
                    <div className="text-sm text-muted-foreground">Automatically email receipts after sales</div>
                  </div>
                  <Switch checked={emailReceiptsEnabled} onCheckedChange={setEmailReceiptsEnabled} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <div className="font-medium">Repair Status Emails</div>
                    <div className="text-sm text-muted-foreground">Email customers when ticket status changes</div>
                  </div>
                  <Switch checked={repairStatusEmailsEnabled} onCheckedChange={setRepairStatusEmailsEnabled} />
                </div>
                <Separator className="my-2" />
                <h4 className="text-sm font-semibold flex items-center gap-2"><Building className="w-3.5 h-3.5" /> Sender Settings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="senderName">Sender Name</Label>
                    <Input id="senderName" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Your Business Name" data-testid="input-sender-name" />
                    <p className="text-xs text-muted-foreground mt-1">Shown as the "From" name in customer emails</p>
                  </div>
                  <div>
                    <Label htmlFor="senderEmail">Sender Email</Label>
                    <Input id="senderEmail" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="noreply@yourdomain.com" type="email" data-testid="input-sender-email" />
                    <p className="text-xs text-muted-foreground mt-1">Reply-to address for customer emails</p>
                  </div>
                </div>
                <Separator className="my-2" />
                <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Estimates</h4>
                <div>
                  <Label htmlFor="estimateTerms">Default Estimate Terms</Label>
                  <Textarea id="estimateTerms" value={defaultEstimateTerms} onChange={e => setDefaultEstimateTerms(e.target.value)} placeholder="e.g., Estimate valid for 30 days. Parts and labor may vary." rows={3} data-testid="textarea-estimate-terms" />
                  <p className="text-xs text-muted-foreground mt-1">Default terms printed on repair estimates</p>
                </div>
                <Separator className="my-2" />
                <h4 className="text-sm font-semibold flex items-center gap-2"><Image className="w-3.5 h-3.5" /> Email Branding</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="footerText">Email Footer Text</Label>
                    <Input id="footerText" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Custom text shown at the bottom of emails" data-testid="input-footer-text" />
                  </div>
                </div>
                <Button onClick={handleSaveEmail} disabled={saveMutation.isPending} data-testid="button-save-email">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Email Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Email Templates<span className="text-xs font-normal text-muted-foreground ml-2">Applies to all stores</span></CardTitle>
                <p className="text-sm text-muted-foreground">Customize customer-facing email notifications sent from your store.</p>
              </CardHeader>
              <CardContent>
                <EmailTemplatesContent />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            {billingLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : (
              <div className="space-y-4">
                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Card on File<ScopeLabel text="Account-level setting" /></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {billingData?.cardOnFile?.brand ? (
                      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium" data-testid="text-card-brand">{billingData.cardOnFile.brand} ending in {billingData.cardOnFile.last4}</div>
                            <div className="text-sm text-muted-foreground" data-testid="text-card-exp">Expires {String(billingData.cardOnFile.expMonth).padStart(2, "0")}/{billingData.cardOnFile.expYear}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setUpdateCardDialog(true)} data-testid="button-update-card">
                          Update Card
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">No card on file</div>
                            <div className="text-sm text-muted-foreground">Add a billing card to enable automated billing</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setUpdateCardDialog(true)} data-testid="button-add-card">
                          Add Card
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Next Automatic Payment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {billingData?.scheduledPaymentDisplay ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
                          <CalendarClock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">Next Automatic Payment Run</div>
                            <div className="text-lg font-semibold" data-testid="text-next-billing-date">
                              {billingData.scheduledPaymentDisplay}
                            </div>
                            <div className="text-xs text-muted-foreground">America/Detroit (Eastern Time)</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Monthly Software Fee</div>
                            <div className="text-sm font-semibold mt-0.5" data-testid="text-upcoming-monthly-fee">${parseFloat(billingData?.monthlyFee || "0").toFixed(2)}</div>
                          </div>
                          <div className="p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Min. Card Volume</div>
                            <div className="text-sm font-semibold mt-0.5" data-testid="text-upcoming-min-volume">${parseFloat(billingData?.minimumMonthlyCardVolume || "20000").toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                          <div className="p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Below-Threshold Fee</div>
                            <div className="text-sm font-semibold mt-0.5" data-testid="text-upcoming-threshold-fee">${parseFloat(billingData?.belowThresholdFee || "30").toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Billing Status</div>
                            <div className="mt-0.5">
                              <Badge
                                variant={billingData?.billingStatus === "active" ? "default" : "secondary"}
                                data-testid="badge-upcoming-billing-status"
                              >
                                {billingData?.billingStatus === "active" && <CheckCircle className="w-3 h-3 mr-1" />}
                                {billingData?.billingStatus === "pending_setup" && <Clock className="w-3 h-3 mr-1" />}
                                {humanizeBillingStatus(billingData?.billingStatus)}
                              </Badge>
                            </div>
                          </div>
                          {parseFloat(billingData?.outstandingBalance || "0") > 0 && (
                            <div className="p-3 rounded-lg border border-destructive bg-destructive/5">
                              <div className="text-xs text-muted-foreground">Outstanding Balance</div>
                              <div className="text-sm font-semibold mt-0.5 text-destructive" data-testid="text-upcoming-outstanding">
                                ${parseFloat(billingData.outstandingBalance).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                        {billingData?.paymentStatus && billingData.paymentStatus !== "current" && (
                          <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                              <span className="font-medium text-yellow-800 dark:text-yellow-300">Payment status: {humanizeBillingStatus(billingData.paymentStatus)}</span>
                              {billingData.retryCount > 0 && (
                                <span className="text-muted-foreground"> — {billingData.retryCount} retry attempt(s)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium" data-testid="text-no-upcoming-billing">No upcoming billing scheduled</div>
                          <div className="text-sm text-muted-foreground">Automatic billing will be scheduled after onboarding is complete.</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Billing Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border border-border">
                        <div className="text-sm text-muted-foreground">Monthly Software Fee</div>
                        <div className="text-lg font-semibold mt-1" data-testid="text-monthly-fee">${parseFloat(billingData?.monthlyFee || "0").toFixed(2)}</div>
                      </div>
                      <div className="p-4 rounded-lg border border-border">
                        <div className="text-sm text-muted-foreground">Billing Status</div>
                        <div className="mt-1">
                          <Badge
                            variant={billingData?.billingStatus === "active" ? "default" : "secondary"}
                            data-testid="badge-billing-status"
                          >
                            {billingData?.billingStatus === "active" && <CheckCircle className="w-3 h-3 mr-1" />}
                            {billingData?.billingStatus === "pending_setup" && <Clock className="w-3 h-3 mr-1" />}
                            {humanizeBillingStatus(billingData?.billingStatus)}
                          </Badge>
                        </div>
                      </div>
                      {onboardingStatus?.paymentStatus && onboardingStatus.paymentStatus !== "current" && (
                        <div className="p-4 rounded-lg border border-destructive bg-destructive/5">
                          <div className="text-sm text-muted-foreground">Payment Status</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="destructive" data-testid="badge-payment-status">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {humanizeBillingStatus(onboardingStatus.paymentStatus)}
                            </Badge>
                            {parseFloat(onboardingStatus.outstandingBalance || "0") > 0 && (
                              <span className="text-sm font-medium text-destructive" data-testid="text-outstanding-balance">
                                Outstanding: ${parseFloat(onboardingStatus.outstandingBalance).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="p-4 rounded-lg border border-border">
                      <div className="font-medium mb-2">Threshold Rule</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div data-testid="text-threshold-volume">
                          Minimum monthly card volume: <span className="font-medium text-foreground">${parseFloat(billingData?.minimumMonthlyCardVolume || "20000").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div data-testid="text-threshold-fee">
                          Below-threshold surcharge: <span className="font-medium text-foreground">${parseFloat(billingData?.belowThresholdFee || "30").toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        If your monthly card processing volume falls below the minimum, an additional surcharge will be applied to your billing.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-card-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Billing History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {historyLoading ? (
                      <div className="p-4"><Skeleton className="h-32" /></div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingHistory.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No billing history yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            billingHistory.map((txn: any) => {
                              const isExpanded = expandedTxn === txn.id;
                              return (
                                <>
                                  <TableRow
                                    key={txn.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setExpandedTxn(isExpanded ? null : txn.id)}
                                    data-testid={`row-billing-txn-${txn.id}`}
                                  >
                                    <TableCell className="text-sm">
                                      {txn.date ? new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "—"}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm" data-testid={`text-txn-amount-${txn.id}`}>
                                      ${parseFloat(txn.amount).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={txn.status === "paid" ? "default" : txn.status === "waived" ? "secondary" : txn.status === "failed" || txn.status === "card update needed" ? "destructive" : "secondary"}
                                        className="text-xs"
                                        data-testid={`badge-txn-status-${txn.id}`}
                                      >
                                        {txn.status === "paid" && <CheckCircle className="w-3 h-3 mr-1" />}
                                        {(txn.status === "failed" || txn.status === "card update needed") && <AlertCircle className="w-3 h-3 mr-1" />}
                                        {humanizeBillingStatus(txn.status)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {txn.billingPeriodStart && txn.billingPeriodEnd ? (
                                        `${new Date(txn.billingPeriodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} — ${new Date(txn.billingPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`
                                      ) : "—"}
                                    </TableCell>
                                    <TableCell>
                                      {txn.status === "paid" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2"
                                          asChild
                                          onClick={(e: any) => e.stopPropagation()}
                                          data-testid={`button-receipt-${txn.id}`}
                                        >
                                          <a href={`/api/merchant/billing/transactions/${txn.id}/receipt`} target="_blank" rel="noopener noreferrer">
                                            <Receipt className="w-3.5 h-3.5" />
                                          </a>
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow key={`${txn.id}-detail`} data-testid={`row-billing-detail-${txn.id}`}>
                                      <TableCell colSpan={5} className="bg-muted/30 p-4">
                                        <div className="space-y-3">
                                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Charge Breakdown</div>
                                          <div className="space-y-1.5">
                                            {txn.lineItems?.map((item: any, i: number) => (
                                              <div key={i} className="flex justify-between items-start text-sm">
                                                <div>
                                                  <span className="font-medium">{item.label}</span>
                                                  {item.description && <span className="text-muted-foreground ml-2 text-xs">({item.description})</span>}
                                                </div>
                                                <span className="font-medium">${parseFloat(item.amount).toFixed(2)}</span>
                                              </div>
                                            ))}
                                          </div>
                                          {txn.surchargeApplied && txn.cardVolume && (
                                            <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                                              <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-600" />
                                              Card volume of ${parseFloat(txn.cardVolume).toLocaleString(undefined, { minimumFractionDigits: 2 })} was below the ${parseFloat(txn.minimumMonthlyCardVolume || "20000").toLocaleString(undefined, { minimumFractionDigits: 2 })} minimum threshold.
                                            </div>
                                          )}
                                          {txn.statusExplanation && (
                                            <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                                              <AlertCircle className="w-3 h-3 inline mr-1" />
                                              {txn.statusExplanation}
                                            </div>
                                          )}
                                          <Separator />
                                          <div className="flex justify-between items-center text-sm font-semibold">
                                            <span>{txn.adjustmentStatus === "waived" ? "Total (Waived)" : "Total Charged"}</span>
                                            <span>${parseFloat(txn.amount).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {isOwner && storeThresholds && storeThresholds.length > 0 && (
                  <Card className="border-card-border" data-testid="card-store-thresholds">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4" /> Per-Store Threshold Summary<ScopeLabel text="Per store" /></CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Store</TableHead>
                            <TableHead>Current Month Volume</TableHead>
                            <TableHead>Threshold Target</TableHead>
                            <TableHead>Below-Threshold Fee</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {storeThresholds.map((t: any) => (
                            <TableRow key={t.storeId} data-testid={`row-store-threshold-${t.storeId}`}>
                              <TableCell className="font-medium">{t.storeName}</TableCell>
                              <TableCell className="text-sm" data-testid={`text-store-volume-${t.storeId}`}>
                                ${parseFloat(t.cardVolume || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-sm">
                                ${parseFloat(t.thresholdTarget || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-sm">
                                ${parseFloat(t.belowThresholdFee || "0").toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={t.status === "Met" ? "default" : t.status === "Below threshold" ? "destructive" : "secondary"}
                                  className="text-xs"
                                  data-testid={`badge-store-threshold-${t.storeId}`}
                                >
                                  {t.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-4 pb-3 pt-2">
                        <p className="text-xs text-muted-foreground">
                          Card-volume thresholds are tracked per store, not across all stores. If a store does not meet its threshold, the below-threshold fee applies to that store only.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="receipts">
            <div className="space-y-4">
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Receipt Settings<ScopeLabel text="Global defaults — applies to all stores" /></CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Control what appears on printed and emailed receipts. Changes apply to all new receipts.</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building className="w-3.5 h-3.5" /> Header / Store Identity</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-logo">
                            <Label className="text-sm">Show uploaded logo</Label>
                            <Switch checked={rcptShowLogo} onCheckedChange={setRcptShowLogo} />
                          </div>
                          <div>
                            <Label className="text-sm">Business Logo</Label>
                            {logoUrl ? (
                              <div className="mt-2 flex items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border">
                                <img src={logoUrl} alt="Business logo" className="max-h-12 max-w-[160px] object-contain rounded" data-testid="img-merchant-logo" />
                                <div className="flex flex-col gap-1.5">
                                  <label className="cursor-pointer">
                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setLogoUploading(true);
                                      try {
                                        const fd = new FormData();
                                        fd.append("logo", file);
                                        const res = await fetch("/api/merchant/settings/logo", { method: "POST", body: fd, credentials: "include" });
                                        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
                                        await res.json();
                                        await queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
                                        toast({ title: "Logo updated" });
                                      } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
                                      finally { setLogoUploading(false); e.target.value = ""; }
                                    }} data-testid="input-replace-merchant-logo" />
                                    <span className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                                      <Upload className="w-3.5 h-3.5" /> Replace
                                    </span>
                                  </label>
                                  <button onClick={async () => {
                                    try {
                                      const res = await fetch("/api/merchant/settings/logo", { method: "DELETE", credentials: "include" });
                                      if (!res.ok) throw new Error("Failed");
                                      await queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
                                      toast({ title: "Logo removed" });
                                    } catch (err: any) { toast({ title: "Remove failed", description: err.message, variant: "destructive" }); }
                                  }} className="inline-flex items-center gap-1 text-sm text-destructive hover:underline text-left" data-testid="button-remove-merchant-logo">
                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="mt-2 flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setLogoUploading(true);
                                  try {
                                    const fd = new FormData();
                                    fd.append("logo", file);
                                    const res = await fetch("/api/merchant/settings/logo", { method: "POST", body: fd, credentials: "include" });
                                    if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
                                    await res.json();
                                    await queryClient.invalidateQueries({ queryKey: ["/api/merchant/settings"] });
                                    toast({ title: "Logo uploaded" });
                                  } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
                                  finally { setLogoUploading(false); e.target.value = ""; }
                                }} data-testid="input-upload-merchant-logo" />
                                {logoUploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Image className="w-5 h-5 text-muted-foreground" />}
                                <span className="text-xs text-muted-foreground">{logoUploading ? "Uploading..." : "Upload logo (PNG, JPG, SVG — max 2MB)"}</span>
                              </label>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">Used on receipts, emails, and in the navigation header</p>
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-business-name">
                            <Label className="text-sm">Show business name</Label>
                            <Switch checked={rcptShowBusinessName} onCheckedChange={setRcptShowBusinessName} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-store-name">
                            <Label className="text-sm">Show store name</Label>
                            <Switch checked={rcptShowStoreName} onCheckedChange={setRcptShowStoreName} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-address">
                            <Label className="text-sm">Show address</Label>
                            <Switch checked={rcptShowAddress} onCheckedChange={setRcptShowAddress} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-phone">
                            <Label className="text-sm">Show phone</Label>
                            <Switch checked={rcptShowPhone} onCheckedChange={setRcptShowPhone} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-email-website">
                            <Label className="text-sm">Show email/website</Label>
                            <Switch checked={rcptShowEmailWebsite} onCheckedChange={setRcptShowEmailWebsite} />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Body / Display</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-customer-name">
                            <Label className="text-sm">Show customer name</Label>
                            <Switch checked={rcptShowCustomerName} onCheckedChange={setRcptShowCustomerName} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-cashier-name">
                            <Label className="text-sm">Show cashier name</Label>
                            <Switch checked={rcptShowCashierName} onCheckedChange={setRcptShowCashierName} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-ticket-number">
                            <Label className="text-sm">Show ticket # (repairs)</Label>
                            <Switch checked={rcptShowTicketNumber} onCheckedChange={setRcptShowTicketNumber} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-serial-imei">
                            <Label className="text-sm">Show serial/IMEI</Label>
                            <Switch checked={rcptShowSerialImei} onCheckedChange={setRcptShowSerialImei} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-pricing-mode">
                            <Label className="text-sm">Show pricing mode (Cash/Card Rate)</Label>
                            <Switch checked={rcptShowPricingMode} onCheckedChange={setRcptShowPricingMode} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-discount-line">
                            <Label className="text-sm">Show discount line</Label>
                            <Switch checked={rcptShowDiscountLine} onCheckedChange={setRcptShowDiscountLine} />
                          </div>
                          <div className="flex items-center justify-between" data-testid="rcpt-toggle-tax-line">
                            <Label className="text-sm">Show tax line</Label>
                            <Switch checked={rcptShowTaxLine} onCheckedChange={setRcptShowTaxLine} />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Edit className="w-3.5 h-3.5" /> Footer</h4>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Custom footer message</Label>
                            <Input value={rcptFooterText} onChange={e => setRcptFooterText(e.target.value)} placeholder="Thank you for your business!" maxLength={200} data-testid="input-receipt-footer" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Return / refund policy</Label>
                            <Textarea value={rcptReturnPolicy} onChange={e => setRcptReturnPolicy(e.target.value)} placeholder="All sales final. No refunds or exchanges." rows={2} maxLength={500} data-testid="input-receipt-return-policy" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Warranty / disclaimer</Label>
                            <Textarea value={rcptWarrantyText} onChange={e => setRcptWarrantyText(e.target.value)} placeholder="90-day warranty on all repairs." rows={2} maxLength={500} data-testid="input-receipt-warranty" />
                          </div>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => saveMutation.mutate({ settingsData: {
                          receiptShowLogo: rcptShowLogo,
                          receiptShowBusinessName: rcptShowBusinessName,
                          receiptShowStoreName: rcptShowStoreName,
                          receiptShowAddress: rcptShowAddress,
                          receiptShowPhone: rcptShowPhone,
                          receiptShowEmailWebsite: rcptShowEmailWebsite,
                          receiptShowCustomerName: rcptShowCustomerName,
                          receiptShowCashierName: rcptShowCashierName,
                          receiptShowTicketNumber: rcptShowTicketNumber,
                          receiptShowSerialImei: rcptShowSerialImei,
                          receiptShowPricingMode: rcptShowPricingMode,
                          receiptShowDiscountLine: rcptShowDiscountLine,
                          receiptShowTaxLine: rcptShowTaxLine,
                          receiptFooterText: rcptFooterText || null,
                          receiptReturnPolicy: rcptReturnPolicy || null,
                          receiptWarrantyText: rcptWarrantyText || null,
                        }})}
                        disabled={saveMutation.isPending}
                        data-testid="btn-save-receipt-settings"
                      >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Receipt Settings
                      </Button>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-3">Live Preview</h4>
                      <Tabs defaultValue="pos" className="w-full">
                        <TabsList className="w-full grid grid-cols-3 text-xs">
                          <TabsTrigger value="pos" className="text-xs" data-testid="preview-tab-pos">POS Sale</TabsTrigger>
                          <TabsTrigger value="deposit" className="text-xs" data-testid="preview-tab-deposit">Ticket Deposit</TabsTrigger>
                          <TabsTrigger value="final" className="text-xs" data-testid="preview-tab-final">Ticket Final</TabsTrigger>
                        </TabsList>

                        {["pos", "deposit", "final"].map(previewType => {
                          const isDeposit = previewType === "deposit";
                          const isFinal = previewType === "final";
                          const isTicket = isDeposit || isFinal;
                          const sampleStoreName = stores?.[0]?.name || data?.tenant?.businessName || "My Store";
                          const sampleAddr = stores?.[0] ? `${stores[0].address || "123 Main St"}, ${stores[0].city || "Anytown"} ${stores[0].state || "ST"} ${stores[0].zip || "00000"}` : "123 Main St, Anytown ST 00000";
                          const samplePhone = stores?.[0]?.phone || data?.tenant?.primaryPhone || "(555) 123-4567";
                          const sampleEmail = data?.tenant?.primaryEmail || "info@mystore.com";

                          return (
                            <TabsContent key={previewType} value={previewType}>
                              <div className="border rounded-lg p-4 bg-white dark:bg-zinc-950 font-mono text-[11px] leading-[1.35] max-w-[280px] mx-auto shadow-sm" data-testid={`receipt-preview-${previewType}`}>
                                {rcptShowLogo && logoUrl && (
                                  <div className="text-center mb-1"><img src={logoUrl} alt="" className="max-h-[40px] mx-auto object-contain" /></div>
                                )}
                                {rcptShowBusinessName && <div className="text-center font-bold text-[13px]">{data?.tenant?.businessName || "Business Name"}</div>}
                                {rcptShowStoreName && sampleStoreName !== data?.tenant?.businessName && <div className="text-center text-[10px]">{sampleStoreName}</div>}
                                {rcptShowAddress && <div className="text-center text-[10px] text-muted-foreground">{sampleAddr}</div>}
                                {rcptShowPhone && <div className="text-center text-[10px] text-muted-foreground">{samplePhone}</div>}
                                {rcptShowEmailWebsite && <div className="text-center text-[10px] text-muted-foreground">{sampleEmail}</div>}

                                <hr className="border-dashed my-2 border-foreground/30" />

                                <div className="flex justify-between"><span>Sale #</span><span>S-000042</span></div>
                                <div className="flex justify-between"><span>Date</span><span>Mar 19, 2026 2:15 PM</span></div>
                                {rcptShowCashierName && <div className="flex justify-between"><span>Cashier</span><span>Sarah Miller</span></div>}
                                {rcptShowCustomerName && <div className="flex justify-between"><span>Customer</span><span>John Smith</span></div>}
                                {isTicket && rcptShowTicketNumber && <div className="flex justify-between"><span>Ticket #</span><span>T-0087</span></div>}

                                <hr className="border-dashed my-2 border-foreground/30" />

                                {isTicket ? (
                                  <div className="flex justify-between font-medium">
                                    <span>{isDeposit ? "Repair Deposit" : "Repair Final Payment"}</span>
                                    <span>{isDeposit ? "$50.00" : "$149.99"}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between"><span>iPhone Screen Protector</span><span>$12.99</span></div>
                                    {rcptShowSerialImei && <div className="text-[9px] text-muted-foreground pl-1">S/N: SN2024-001</div>}
                                    <div className="flex justify-between"><span>USB-C Cable</span><span>$9.99</span></div>
                                    <div className="text-[9px] text-muted-foreground pl-1">2 x $4.99</div>
                                  </>
                                )}

                                <hr className="border-dashed my-2 border-foreground/30" />

                                {!isTicket && (
                                  <>
                                    <div className="flex justify-between"><span>Subtotal</span><span>$22.98</span></div>
                                    {rcptShowDiscountLine && <div className="flex justify-between text-muted-foreground"><span>Discount (10%)</span><span>-$2.30</span></div>}
                                    {rcptShowTaxLine && <div className="flex justify-between"><span>Tax</span><span>$1.24</span></div>}
                                  </>
                                )}
                                <div className="flex justify-between font-bold text-[13px]"><span>TOTAL</span><span>{isDeposit ? "$50.00" : isTicket ? "$149.99" : "$21.92"}</span></div>

                                <hr className="border-dashed my-2 border-foreground/30" />

                                <div className="flex justify-between"><span>Payment</span><span>Cash</span></div>
                                {rcptShowPricingMode && <div className="flex justify-between"><span>Pricing</span><span>Cash Rate</span></div>}
                                <div className="flex justify-between"><span>Status</span><span>COMPLETED</span></div>

                                {(rcptFooterText || rcptReturnPolicy || rcptWarrantyText) && (
                                  <>
                                    <hr className="border-dashed my-2 border-foreground/30" />
                                    {rcptFooterText && <div className="text-center text-[9px] text-muted-foreground break-words overflow-hidden max-h-[40px]">{rcptFooterText}</div>}
                                    {rcptReturnPolicy && <div className="text-center text-[9px] text-muted-foreground mt-1 break-words overflow-hidden max-h-[60px]">{rcptReturnPolicy}</div>}
                                    {rcptWarrantyText && <div className="text-center text-[9px] text-muted-foreground mt-1 break-words overflow-hidden max-h-[60px]">{rcptWarrantyText}</div>}
                                  </>
                                )}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <Card className="border-card-border">
              <CardContent className="pt-6">
                <EmployeesContent />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terminals">
            <Card className="border-card-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Wifi className="w-4 h-4" /> Terminal Configuration<ScopeLabel text="Per store / per terminal" /></CardTitle>
              </CardHeader>
              <CardContent>
                <MerchantTerminalsContent />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Store Dialog */}
      <Dialog open={!!editStore} onOpenChange={(open) => { if (!open) setEditStore(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Store</DialogTitle></DialogHeader>
          {editStore && (
            <StoreForm
              defaultValues={editStore}
              isPending={saveStoreMutation.isPending}
              onSubmit={(data) => saveStoreMutation.mutate(data)}
              onError={(msg) => toast({ title: "Error", description: msg, variant: "destructive" })}
              submitLabel="Update Store"
              allStores={data?.stores || stores}
              billingData={isOwner ? billingData : undefined}
              isOwner={isOwner}
              storeThresholds={isOwner ? storeThresholds : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Store Dialog */}
      <Dialog open={createStoreDialog} onOpenChange={setCreateStoreDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Store</DialogTitle></DialogHeader>
          <StoreForm
            isPending={createStoreMutation.isPending}
            onSubmit={(data) => createStoreMutation.mutate(data)}
            submitLabel="Create Store"
            billingData={isOwner ? billingData : undefined}
            billingLoading={billingLoading}
            isOwner={isOwner}
          />
        </DialogContent>
      </Dialog>

      {/* Update Billing Card Dialog */}
      <Dialog open={updateCardDialog} onOpenChange={setUpdateCardDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Update Billing Card</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            updateCardMutation.mutate({
              cardNumber: (fd.get("cardNumber") as string).replace(/\s/g, ""),
              expMonth: parseInt(fd.get("expMonth") as string),
              expYear: parseInt(fd.get("expYear") as string),
              cvv: fd.get("cvv") as string,
              cardholderName: fd.get("cardholderName") as string,
            });
          }} className="space-y-4">
            <div><Label>Cardholder Name</Label><Input name="cardholderName" required placeholder="John Doe" data-testid="input-cardholder-name" /></div>
            <div><Label>Card Number</Label><Input name="cardNumber" required placeholder="4111 1111 1111 1111" data-testid="input-card-number" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Exp Month</Label><Input name="expMonth" type="number" min="1" max="12" required placeholder="MM" data-testid="input-exp-month" /></div>
              <div><Label>Exp Year</Label><Input name="expYear" type="number" min="2025" max="2050" required placeholder="YYYY" data-testid="input-exp-year" /></div>
              <div><Label>CVV</Label><Input name="cvv" required placeholder="123" maxLength={4} data-testid="input-cvv" /></div>
            </div>
            <Button type="submit" className="w-full" disabled={updateCardMutation.isPending} data-testid="button-submit-card">
              {updateCardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Update Card
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Tax Rate Dialog */}
      <Dialog open={taxRateDialog} onOpenChange={(open) => { setTaxRateDialog(open); if (!open) setNewTaxDefault(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Tax Rate</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            createTaxRateMutation.mutate({
              name: fd.get("name"),
              rate: (parseFloat(fd.get("rate") as string) / 100).toFixed(4),
              isDefault: newTaxDefault,
            });
          }} className="space-y-4">
            <div><Label>Name</Label><Input name="name" required placeholder="Sales Tax" data-testid="input-tax-name" /></div>
            <div><Label>Rate (%)</Label><Input name="rate" type="number" step="0.01" required placeholder="8.25" data-testid="input-tax-rate" /></div>
            <div className="flex items-center gap-3">
              <Switch checked={newTaxDefault} onCheckedChange={setNewTaxDefault} data-testid="switch-tax-default" />
              <Label>Set as default</Label>
            </div>
            <Button type="submit" className="w-full" disabled={createTaxRateMutation.isPending} data-testid="button-save-tax">
              {createTaxRateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Tax Rate
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tax Rate Dialog */}
      <Dialog open={!!editTaxRate} onOpenChange={(open) => { if (!open) setEditTaxRate(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Tax Rate</DialogTitle></DialogHeader>
          {editTaxRate && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateTaxRateMutation.mutate({
                id: editTaxRate.id,
                name: fd.get("name"),
                rate: (parseFloat(fd.get("rate") as string) / 100).toFixed(4),
              });
            }} className="space-y-4">
              <div><Label>Name</Label><Input name="name" defaultValue={editTaxRate.name} required data-testid="input-edit-tax-name" /></div>
              <div><Label>Rate (%)</Label><Input name="rate" type="number" step="0.01" defaultValue={(parseFloat(editTaxRate.rate) * 100).toFixed(2)} required data-testid="input-edit-tax-rate" /></div>
              <Button type="submit" className="w-full" disabled={updateTaxRateMutation.isPending} data-testid="button-update-tax">
                {updateTaxRateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Tax Rate
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}

function StoreForm({ defaultValues, isPending, onSubmit, onError, submitLabel, allStores = [], billingData, billingLoading, isOwner, storeThresholds }: {
  defaultValues?: any;
  isPending: boolean;
  onSubmit: (data: any) => void;
  onError?: (msg: string) => void;
  submitLabel: string;
  allStores?: any[];
  billingData?: any;
  billingLoading?: boolean;
  isOwner?: boolean;
  storeThresholds?: any[];
}) {
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [timezone, setTimezone] = useState(defaultValues?.timezone || "");
  const [showDeactivateWarning, setShowDeactivateWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isDeactivating = defaultValues?.isActive && !isActive;
  const activeStoreCount = allStores.filter((s: any) => s.isActive).length;
  const isLastActive = defaultValues && defaultValues.isActive && activeStoreCount <= 1;
  const isCreate = !defaultValues;
  const showBillingDisclosure = isOwner && isCreate;
  const showBillingReadOnly = isOwner && !isCreate;
  const timezoneSelected = timezone !== "";

  const storeThreshold = storeThresholds?.find((t: any) => t.storeId === defaultValues?.id);

  const billingUnavailable = showBillingDisclosure && !billingLoading && !billingData;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!timezoneSelected) return;
    const fd = new FormData(e.currentTarget);
    const formData = {
      name: fd.get("name"),
      address: fd.get("address") || null,
      city: fd.get("city") || null,
      state: fd.get("state") || null,
      zip: fd.get("zip") || null,
      phone: fd.get("phone") || null,
      email: fd.get("email") || null,
      timezone,
      isActive,
    };

    if (isDeactivating && isLastActive) {
      onError?.("Cannot deactivate the last active store. At least one store must remain active.");
      setIsActive(true);
      return;
    }

    if (isDeactivating) {
      setPendingFormData(formData);
      setShowDeactivateWarning(true);
      return;
    }

    onSubmit(formData);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><Label>Store Name</Label><Input name="name" defaultValue={defaultValues?.name} required data-testid="input-store-name" /></div>

        {showBillingDisclosure && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="section-billing-impact">
              <div className="font-medium text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Billing Impact for This Store
              </div>
              {billingLoading ? (
                <Skeleton className="h-20" />
              ) : billingUnavailable ? (
                <div className="p-3 rounded-lg border border-destructive bg-destructive/5 text-sm text-destructive flex items-start gap-2" data-testid="text-billing-unavailable">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Store billing terms could not be loaded. Please review Billing settings before adding a store.</span>
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly software fee</span>
                      <span className="font-medium" data-testid="text-billing-monthly-fee">${parseFloat(billingData?.monthlyFee || "0").toFixed(2)} / month</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min. monthly card volume</span>
                      <span className="font-medium" data-testid="text-billing-min-volume">${parseFloat(billingData?.minimumMonthlyCardVolume || "20000").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Below-threshold fee</span>
                      <span className="font-medium" data-testid="text-billing-threshold-fee">${parseFloat(billingData?.belowThresholdFee || "30").toFixed(2)} / month</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="billing-ack"
                      checked={billingAcknowledged}
                      onChange={(e) => setBillingAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-border"
                      data-testid="checkbox-billing-acknowledgment"
                    />
                    <label htmlFor="billing-ack" className="text-xs leading-tight cursor-pointer">
                      I understand this store adds its own monthly fee and its own card-volume threshold.
                    </label>
                  </div>
                </>
              )}
            </div>
            <Separator />
          </>
        )}

        <div><Label>Address</Label><Input name="address" defaultValue={defaultValues?.address} data-testid="input-store-address" /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>City</Label><Input name="city" defaultValue={defaultValues?.city} data-testid="input-store-city" /></div>
          <div><Label>State</Label><Input name="state" defaultValue={defaultValues?.state} data-testid="input-store-state" /></div>
          <div><Label>ZIP</Label><Input name="zip" defaultValue={defaultValues?.zip} data-testid="input-store-zip" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input name="phone" defaultValue={defaultValues?.phone} data-testid="input-store-phone" /></div>
          <div><Label>Email</Label><Input name="email" defaultValue={defaultValues?.email || ""} type="email" placeholder="store@example.com" data-testid="input-store-email" /></div>
        </div>
        <div>
          <Label>Timezone <span className="text-destructive">*</span></Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger data-testid="select-store-timezone" className={submitAttempted && !timezoneSelected ? "border-destructive" : ""}>
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent>
              {US_TIMEZONES.map(tz => (
                <SelectItem key={tz} value={tz}>{TIMEZONE_LABELS[tz] || tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {submitAttempted && !timezoneSelected && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Please select the timezone for this store.
            </p>
          )}
        </div>
        {defaultValues && (
          <div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-store-active" />
              <Label>{isActive ? "Active" : "Inactive"}</Label>
            </div>
            {isDeactivating && isLastActive && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Cannot deactivate the last active store.
              </p>
            )}
          </div>
        )}

        {showBillingReadOnly && storeThreshold && (
          <>
            <Separator />
            <div className="space-y-2" data-testid="section-billing-terms-readonly">
              <div className="font-medium text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Billing Terms for This Store
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly software fee</span>
                  <span className="font-medium">${parseFloat(storeThreshold.monthlyFee || "0").toFixed(2)} / month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min. monthly card volume</span>
                  <span className="font-medium">${parseFloat(storeThreshold.thresholdTarget || "20000").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Below-threshold fee</span>
                  <span className="font-medium">${parseFloat(storeThreshold.belowThresholdFee || "30").toFixed(2)} / month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current month card volume</span>
                  <span className="font-medium">${parseFloat(storeThreshold.cardVolume || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Threshold status</span>
                  <Badge variant={storeThreshold.status === "Met" ? "default" : storeThreshold.status === "Below threshold" ? "destructive" : "secondary"} className="text-xs">
                    {storeThreshold.status}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isPending || (isDeactivating && isLastActive) || billingUnavailable || (showBillingDisclosure && !billingAcknowledged)}
          data-testid="button-submit-store"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </form>
      <AlertDialog open={showDeactivateWarning} onOpenChange={setShowDeactivateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Store?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Deactivating this store may affect:</span>
              <span className="block">• Employee access tied to this store</span>
              <span className="block">• POS sales and inventory operations at this location</span>
              <span className="block">• Open repair tickets assigned to this store</span>
              <span className="block mt-2">Are you sure you want to continue?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-deactivate">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingFormData) onSubmit(pendingFormData); setShowDeactivateWarning(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-deactivate"
            >
              Deactivate Store
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
