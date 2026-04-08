import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MerchantLayout from "@/components/merchant-layout";
import { useStoreContext } from "@/contexts/store-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Loader2, Check, ChevronsUpDown, UserPlus, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { CustomerFormFields, parseCustomerFormData } from "@/components/customer-form";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ready_for_pickup: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  picked_up: "bg-slate-100 text-slate-800 dark:bg-slate-700/30 dark:text-slate-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const statuses = ["all", "new", "in_progress", "ready_for_pickup", "picked_up", "cancelled"];

const DEVICE_TYPES = ["Phone", "Tablet", "Laptop", "Desktop", "Game Console", "Smartwatch", "Other"];

export default function TicketsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedStoreId, isMultiStore } = useStoreContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState("");
  const [selectedTechId, setSelectedTechId] = useState<string>("");

  const [newCustOpen, setNewCustOpen] = useState(false);
  const newCustFormRef = useRef<HTMLFormElement>(null);
  const customerComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerPopoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (customerComboRef.current && !customerComboRef.current.contains(e.target as Node)) {
        setCustomerPopoverOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomerPopoverOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [customerPopoverOpen]);

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/merchant/tickets"],
  });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/customers"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/employees"] });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/merchant/customers", data);
      return res.json();
    },
    onSuccess: (newCustomer: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/customers"] });
      setSelectedCustomerId(newCustomer.id);
      setNewCustOpen(false);
      toast({ title: "Customer created", description: `${newCustomer.firstName} ${newCustomer.lastName} added and selected.` });
    },
    onError: (err: any) => toast({ title: "Could not create customer", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/merchant/tickets", { ...data, storeId: selectedStoreId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/tickets"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Repair ticket created" });
    },
    onError: (err: any) => {
      let desc = err.message || "Unknown error";
      try {
        const parsed = JSON.parse(desc);
        if (parsed.issues) {
          desc = parsed.issues.map((i: any) => `${i.path?.join(".") || "Field"}: ${i.message}`).join("; ");
        }
      } catch {}
      toast({ title: "Could not create ticket", description: desc, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCustomerPopoverOpen(false);
    setSelectedCustomerId(null);
    setSelectedDeviceType("");
    setSelectedTechId("");
  };

  const filtered = tickets.filter((t: any) => {
    if (isMultiStore && selectedStoreId && t.storeId && t.storeId !== selectedStoreId) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const digitsOnly = s.replace(/\D/g, "");
      return t.ticketNumber.toLowerCase().includes(s) || t.brand?.toLowerCase().includes(s) ||
        t.model?.toLowerCase().includes(s) || t.issueDescription?.toLowerCase().includes(s) ||
        t.customerName?.toLowerCase().includes(s) || t.technicianName?.toLowerCase().includes(s) ||
        (t.customerPhone && digitsOnly.length > 0 && t.customerPhone.replace(/\D/g, "").includes(digitsOnly));
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast({ title: "Customer required", description: "Please select or create a customer.", variant: "destructive" });
      return;
    }
    if (!selectedDeviceType) {
      toast({ title: "Device type required", description: "Please select a device type.", variant: "destructive" });
      return;
    }
    const fd = new FormData(e.currentTarget);
    const str = (key: string) => {
      const v = (fd.get(key) as string | null)?.trim();
      return v || undefined;
    };
    const estCompletionRaw = str("estimatedCompletionDate");
    createMutation.mutate({
      customerId: selectedCustomerId,
      assignedEmployeeId: selectedTechId ? parseInt(selectedTechId) : null,
      deviceType: selectedDeviceType,
      brand: str("brand"),
      model: str("model"),
      serialNumber: str("serialNumber"),
      imei: str("imei"),
      issueDescription: fd.get("issueDescription") as string,
      intakeNotes: str("intakeNotes"),
      estimateAmount: str("estimateAmount"),
      estimatedCompletionDate: estCompletionRaw || undefined,
      status: "new",
    });
  };

  const handleNewCustomerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = parseCustomerFormData(fd);
    if (!data.firstName || !data.lastName) {
      toast({ title: "Name required", description: "First and last name are required.", variant: "destructive" });
      return;
    }
    createCustomerMutation.mutate(data);
  };

  const technicians = employees.filter((e: any) => e.merchantRole === "technician" || e.merchantRole === "owner" || e.merchantRole === "manager");

  const selectedCustomer = useMemo(() =>
    customers.find((c: any) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Repair Tickets</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length === tickets.length
                ? `${tickets.length} total tickets`
                : `${filtered.length} of ${tickets.length} tickets`}
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-ticket"><Plus className="w-4 h-4 mr-2" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
              <DialogHeader><DialogTitle>Create Repair Ticket</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className={`space-y-5 flex-1 pr-1 pb-1 ${customerPopoverOpen ? "overflow-visible" : "overflow-y-auto"}`}>
                <div>
                  <Label className="mb-1.5 block">Customer *</Label>
                  <div className="flex items-center gap-2">
                    <div ref={customerComboRef} className="relative flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerPopoverOpen}
                        className="w-full justify-between font-normal"
                        onClick={() => setCustomerPopoverOpen(!customerPopoverOpen)}
                        data-testid="select-customer"
                      >
                        {selectedCustomer
                          ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                          : "Search or select customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      {customerPopoverOpen && (
                        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-50 rounded-md border bg-popover shadow-md">
                          <Command>
                            <CommandInput placeholder="Type a name to search..." data-testid="input-customer-search" />
                            <CommandList className="max-h-[200px]">
                              <CommandEmpty>No customers found.</CommandEmpty>
                              <CommandGroup heading="Customers">
                                {customers.map((c: any) => (
                                  <CommandItem
                                    key={c.id}
                                    value={`${c.firstName} ${c.lastName} ${c.email || ""} ${c.phone || ""}`}
                                    onSelect={() => {
                                      setSelectedCustomerId(c.id);
                                      setCustomerPopoverOpen(false);
                                    }}
                                    data-testid={`option-customer-${c.id}`}
                                  >
                                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedCustomerId === c.id ? "opacity-100" : "opacity-0"}`} />
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate">{c.firstName} {c.lastName}</span>
                                      {(c.phone || c.email) && (
                                        <span className="text-xs text-muted-foreground truncate">{c.phone || c.email}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => setNewCustOpen(true)}
                      data-testid="button-add-new-customer"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="hidden sm:inline">New Customer</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Device Type *</Label>
                    <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                      <SelectTrigger data-testid="select-device-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map((dt) => (
                          <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="mb-1.5 block">Brand</Label><Input name="brand" placeholder="Apple, Samsung..." data-testid="input-brand" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="mb-1.5 block">Model</Label><Input name="model" placeholder="iPhone 15, Galaxy S24..." data-testid="input-model" /></div>
                  <div><Label className="mb-1.5 block">Serial Number</Label><Input name="serialNumber" placeholder="Optional" data-testid="input-serial" /></div>
                </div>
                <div><Label className="mb-1.5 block">IMEI</Label><Input name="imei" placeholder="Optional" data-testid="input-imei" /></div>
                <div><Label className="mb-1.5 block">Issue Description *</Label><Textarea name="issueDescription" required placeholder="Describe the problem..." rows={3} data-testid="input-issue" /></div>
                <div><Label className="mb-1.5 block">Intake Notes</Label><Textarea name="intakeNotes" placeholder="Internal notes..." rows={2} data-testid="input-intake-notes" /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label className="mb-1.5 block">Estimate ($)</Label><Input name="estimateAmount" type="number" step="0.01" placeholder="0.00" data-testid="input-estimate" /></div>
                  <div>
                    <Label className="mb-1.5 block">Assign Technician</Label>
                    <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                      <SelectTrigger data-testid="select-technician"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {technicians.map((e: any) => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.firstName} {e.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="mb-1.5 block">Est. Completion</Label><Input name="estimatedCompletionDate" type="date" data-testid="input-est-completion" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-ticket">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Ticket
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-tickets" />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {statuses.map((s) => (
              <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="whitespace-nowrap text-xs" data-testid={`filter-status-${s}`}>
                {s === "all" ? "All" : statusLabel(s)}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device / Issue</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tickets found</TableCell></TableRow>
                ) : (
                  filtered.map((t: any) => {
                    const isStale = (t.status === "new" || t.status === "in_progress") &&
                      t.createdAt && differenceInDays(new Date(), new Date(t.createdAt)) > 3;
                    const isUnassigned = !t.technicianName && t.status !== "picked_up" && t.status !== "cancelled";
                    return (
                    <TableRow key={t.id} className={`cursor-pointer group ${isStale ? "bg-amber-50/60 dark:bg-amber-950/15 border-l-2 border-l-amber-400 dark:border-l-amber-600" : ""}`} onClick={() => navigate(`/app/tickets/${t.id}`)} data-testid={`row-ticket-${t.id}`}>
                      <TableCell className="font-semibold font-mono text-sm text-primary">{t.ticketNumber}</TableCell>
                      <TableCell className="text-sm">{t.customerName || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[250px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium truncate">{[t.brand, t.model].filter(Boolean).join(" ") || t.deviceType || "—"}</span>
                          <span className="text-xs text-muted-foreground truncate">{t.issueDescription}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isUnassigned ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Unassigned
                          </span>
                        ) : (
                          t.technicianName || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-xs ${statusColors[t.status] || ""}`} variant="secondary">{statusLabel(t.status)}</Badge>
                          {isStale && <Clock className="w-3 h-3 text-amber-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.updatedAt ? format(new Date(t.updatedAt), "MMM d") : t.createdAt ? format(new Date(t.createdAt), "MMM d") : ""}</TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors ml-auto" />
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
          <form ref={newCustFormRef} onSubmit={handleNewCustomerSubmit} className="space-y-3 overflow-y-auto flex-1 pr-1">
            <CustomerFormFields />
          </form>
          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setNewCustOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => newCustFormRef.current?.requestSubmit()}
              disabled={createCustomerMutation.isPending}
              data-testid="button-save-new-customer"
            >
              {createCustomerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MerchantLayout>
  );
}
