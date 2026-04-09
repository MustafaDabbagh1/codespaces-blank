import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Loader2,
  User,
  UserPlus,
  MoreHorizontal,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Link as LinkIcon,
  Trash2,
  Archive,
  AlertTriangle
} from "lucide-react";
import type { Customer, SalesAgent } from "@shared/schema";

const customerSchema = z.object({
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
  country: z.string().optional()
});

type CustomerForm = z.infer<typeof customerSchema>;

const formatDate = (date: Date | string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-2 first:mt-0">
      {children}
    </p>
  );
}

export default function CustomersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [salesOfficeFilter, setSalesOfficeFilter] = useState<string>("all");
  const [portalStatusFilter, setPortalStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deletionCheck, setDeletionCheck] = useState<{ canHardDelete: boolean; linkedCounts: Record<string, number> } | null>(null);
  const [deletionCheckLoading, setDeletionCheckLoading] = useState(false);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", showArchived],
    queryFn: async () => {
      const url = showArchived ? "/api/customers?includeArchived=true" : "/api/customers";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    }
  });

  const { data: salesAgents = [] } = useQuery<SalesAgent[]>({
    queryKey: ["/api/sales-agents"]
  });

  const { data: portalStatuses = {} } = useQuery<Record<string, { status: string }>>({
    queryKey: ["/api/customers/portal-statuses"]
  });

  const agentCompanyMap = useMemo(() => {
    const map = new Map<string, string>();
    salesAgents.forEach((agent) => {
      if (agent.name && agent.companyName) map.set(agent.name, agent.companyName);
    });
    return map;
  }, [salesAgents]);

  const uniqueSalesOffices = useMemo(() =>
    Array.from(new Set(customers.map((c) => c.salesOfficeAgent).filter((s): s is string => !!s && s.trim() !== ""))).sort(),
    [customers]
  );

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
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
      country: "US"
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerForm) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer created", description: "The customer has been added successfully." });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error creating customer", description: "Failed to create customer.", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("DELETE", `/api/customers/${customerId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted", description: "The customer record has been permanently removed." });
      setDeleteTarget(null);
      setDeletionCheck(null);
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Unable to delete this customer.", variant: "destructive" });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("PATCH", `/api/customers/${customerId}/archive`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer archived", description: "The customer has been archived and removed from active lists." });
      setDeleteTarget(null);
      setDeletionCheck(null);
    },
    onError: () => {
      toast({ title: "Archive failed", description: "Unable to archive this customer.", variant: "destructive" });
    }
  });

  const openDeleteDialog = async (customer: Customer) => {
    setDeleteTarget(customer);
    setDeletionCheck(null);
    setDeletionCheckLoading(true);
    try {
      const res = await apiRequest("GET", `/api/customers/${customer.id}/deletion-check`);
      const data = await res.json();
      setDeletionCheck(data);
    } catch {
      toast({ title: "Error", description: "Could not check deletion eligibility.", variant: "destructive" });
      setDeleteTarget(null);
    } finally {
      setDeletionCheckLoading(false);
    }
  };

  useEffect(() => {
    apiRequest("POST", "/api/mx/sync/customers")
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/customers"] }))
      .catch(() => {});
  }, []);

  const [passwordResetCustomer, setPasswordResetCustomer] = useState<Customer | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [dialogPortalStatuses, setDialogPortalStatuses] = useState<Record<string, { status: string; userEmail?: string }>>({});

  const handleInviteCustomer = async (customer: Customer) => {
    try {
      const res = await apiRequest("POST", `/api/customers/${customer.id}/invite`);
      const data = await res.json() as { success: boolean; inviteUrl: string; emailSent?: boolean; message?: string };
      if (data.inviteUrl) {
        const fullUrl = `${window.location.origin}${data.inviteUrl}`;
        if (data.emailSent) {
          toast({ title: "Invitation sent!", description: `Portal invitation email sent to ${customer.email}.` });
        } else {
          await navigator.clipboard.writeText(fullUrl);
          toast({
            title: "Invite link copied!",
            description: customer.email ? "Email delivery pending. Invite link copied to clipboard." : "No email on file. Invite link copied to clipboard."
          });
        }
        fetchPortalStatus(customer.id);
      }
    } catch (error: any) {
      toast({ title: "Failed to generate invite", description: error?.message || "Could not create invite link.", variant: "destructive" });
    }
  };

  const fetchPortalStatus = async (customerId: string) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/portal-status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { status: string; userEmail?: string };
        setDialogPortalStatuses(prev => ({ ...prev, [customerId]: data }));
      }
    } catch {}
  };

  const handleResetPassword = async () => {
    if (!passwordResetCustomer || !newPassword) return;
    try {
      const res = await apiRequest("POST", `/api/customers/${passwordResetCustomer.id}/reset-password`, { newPassword });
      const data = await res.json() as { success: boolean; message: string };
      toast({ title: "Password reset", description: data.message || `Password has been reset for ${passwordResetCustomer.firstName}` });
      setIsPasswordDialogOpen(false);
      setPasswordResetCustomer(null);
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Failed to reset password", description: error?.message || "Could not reset password.", variant: "destructive" });
    }
  };

  const openPortalDialog = (customer: Customer) => {
    setPasswordResetCustomer(customer);
    setNewPassword("");
    fetchPortalStatus(customer.id);
    setIsPasswordDialogOpen(true);
  };

  const onSubmit = (data: CustomerForm) => createMutation.mutate(data);

  const getInitials = (customer: Customer) => {
    const first = customer.firstName?.[0] || "";
    const last = customer.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (salesOfficeFilter !== "all" && customer.salesOfficeAgent !== salesOfficeFilter) return false;
      if (portalStatusFilter !== "all") {
        const ps = portalStatuses[customer.id]?.status;
        if (portalStatusFilter === "active" && ps !== "active") return false;
        if (portalStatusFilter === "pending" && ps !== "pending") return false;
        if (portalStatusFilter === "none" && ps && ps !== "none") return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const name = `${customer.firstName} ${customer.lastName}`.toLowerCase();
        const email = customer.email?.toLowerCase() || "";
        const company = customer.company?.toLowerCase() || "";
        const phone = customer.phone || "";
        const agent = customer.salesOfficeAgent?.toLowerCase() || "";
        const salesCo = agentCompanyMap.get(customer.salesOfficeAgent || "")?.toLowerCase() || "";
        const acct = customer.accountNumber?.toLowerCase() || "";
        const legal = customer.legalCompanyName?.toLowerCase() || "";
        if (!name.includes(s) && !email.includes(s) && !company.includes(s) && !phone.includes(s) && !agent.includes(s) && !salesCo.includes(s) && !acct.includes(s) && !legal.includes(s)) return false;
      }
      return true;
    });
  }, [customers, search, salesOfficeFilter, portalStatusFilter, portalStatuses, agentCompanyMap]);

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Customers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your customer database</p>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="flex flex-col max-h-[88vh]">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add Customer</DialogTitle>
              <DialogDescription>Add a new customer to your database.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 pr-1">
              <Form {...form}>
                <form id="add-customer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pb-1">
                  <SectionLabel>Customer Basics</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="salesOfficeAgent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sales Agent</FormLabel>
                          <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                            <FormControl>
                              <SelectTrigger data-testid="select-sales-agent">
                                <SelectValue placeholder="Select a sales agent" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {salesAgents.filter(a => a.isActive).map((agent) => (
                                <SelectItem key={agent.id} value={agent.name}>{agent.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Account number" data-testid="input-account-number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" data-testid="input-first-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" data-testid="input-last-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@company.com" data-testid="input-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" data-testid="input-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SectionLabel>Business Details</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Name (DBA)</FormLabel>
                          <FormControl>
                            <Input placeholder="Doing Business As" data-testid="input-company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="legalCompanyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Legal entity name" data-testid="input-legal-company-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SectionLabel>Address</SectionLabel>
                  <FormField
                    control={form.control}
                    name="address1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" data-testid="input-address1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" data-testid="input-address2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" data-testid="input-city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" data-testid="input-state" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" data-testid="input-postal-code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="US" data-testid="input-country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset(); }}>
                Cancel
              </Button>
              <Button form="add-customer-form" type="submit" disabled={createMutation.isPending} data-testid="button-submit-customer">
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-customer-count">
          {isLoading ? "Loading..." : `${filteredCustomers.length} ${filteredCustomers.length === 1 ? "customer" : "customers"}`}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={salesOfficeFilter} onValueChange={setSalesOfficeFilter}>
            <SelectTrigger className="h-8 w-44 text-sm" data-testid="select-sales-office-filter">
              <SelectValue placeholder="All Sales Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Agents</SelectItem>
              {uniqueSalesOffices.map((office) => (
                <SelectItem key={office} value={office}>{office}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portalStatusFilter} onValueChange={setPortalStatusFilter}>
            <SelectTrigger className="h-8 w-44 text-sm" data-testid="select-portal-filter">
              <SelectValue placeholder="Customer Center" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access Levels</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Invited</SelectItem>
              <SelectItem value="none">No Access</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={showArchived ? "secondary" : "outline"}
            className="h-8"
            onClick={() => setShowArchived(v => !v)}
            data-testid="button-toggle-archived"
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <Button size="sm" className="h-8" onClick={() => setIsDialogOpen(true)} data-testid="button-add-customer">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <User className="h-9 w-9 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {customers.length === 0 ? "No customers yet" : "No customers match your filters"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {customers.length === 0 ? "Add your first customer to get started." : "Try adjusting your search or filters."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Customer</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Contact</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Portal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const portalStatus = portalStatuses[customer.id]?.status;
                  const subLine = [customer.company, customer.accountNumber ? `#${customer.accountNumber}` : null].filter(Boolean).join(" · ");

                  return (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      data-testid={`row-customer-${customer.id}`}
                    >
                      {/* Customer cell — name + DBA/acct# + agent */}
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {getInitials(customer)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm leading-snug" data-testid={`text-customer-name-${customer.id}`}>
                                {customer.firstName} {customer.lastName}
                              </span>
                              {customer.isArchived && (
                                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground px-1.5 py-0" data-testid={`badge-archived-${customer.id}`}>Archived</Badge>
                              )}
                            </div>
                            {subLine && (
                              <span className="text-[11px] text-muted-foreground/70 leading-tight truncate">{subLine}</span>
                            )}
                            {customer.salesOfficeAgent && (
                              <span className="text-[11px] text-muted-foreground/50 leading-tight truncate" data-testid={`text-sales-agent-${customer.id}`}>{customer.salesOfficeAgent}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact cell */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {customer.email ? (
                            <span className="text-sm leading-snug">{customer.email}</span>
                          ) : null}
                          {customer.phone ? (
                            <span className="text-xs text-muted-foreground leading-snug">{customer.phone}</span>
                          ) : null}
                          {!customer.email && !customer.phone && (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Portal status cell — badge only, actions in overflow menu */}
                      <TableCell>
                        {portalStatus === "active" ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-normal" data-testid={`badge-portal-${customer.id}`}>
                            Active
                          </Badge>
                        ) : portalStatus === "pending" ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal" data-testid={`badge-portal-${customer.id}`}>
                            Invited
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground font-normal" data-testid={`badge-portal-${customer.id}`}>
                            No Access
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions cell */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-customer-actions-${customer.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/customers/${customer.id}`);
                              }}
                              data-testid={`menu-view-customer-${customer.id}`}
                            >
                              <User className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(!portalStatus || portalStatus === "none") && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteCustomer(customer);
                                }}
                                data-testid={`menu-send-invite-${customer.id}`}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Send Invite
                              </DropdownMenuItem>
                            )}
                            {portalStatus === "pending" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteCustomer(customer);
                                }}
                                data-testid={`menu-resend-invite-${customer.id}`}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openPortalDialog(customer);
                              }}
                              data-testid={`button-manage-portal-${customer.id}`}
                            >
                              <KeyRound className="h-4 w-4 mr-2" />
                              Manage Portal Access
                            </DropdownMenuItem>
                            {!customer.isArchived && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteDialog(customer);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`menu-delete-customer-${customer.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Customer
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

      {/* Manage Portal Access dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Manage Portal Access
            </DialogTitle>
            <DialogDescription>
              {passwordResetCustomer && `${passwordResetCustomer.firstName} ${passwordResetCustomer.lastName}`}
            </DialogDescription>
          </DialogHeader>

          {passwordResetCustomer && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Portal Status</span>
                  {dialogPortalStatuses[passwordResetCustomer.id]?.status === "active" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-normal">
                      <ShieldCheck className="h-3 w-3 mr-1" />Active
                    </Badge>
                  ) : dialogPortalStatuses[passwordResetCustomer.id]?.status === "pending" ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 font-normal">
                      <LinkIcon className="h-3 w-3 mr-1" />Invitation Pending
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground font-normal">
                      <ShieldAlert className="h-3 w-3 mr-1" />No Access
                    </Badge>
                  )}
                </div>
                {dialogPortalStatuses[passwordResetCustomer.id]?.userEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Login Email</span>
                    <span className="text-sm font-medium">{dialogPortalStatuses[passwordResetCustomer.id].userEmail}</span>
                  </div>
                )}
              </div>

              {dialogPortalStatuses[passwordResetCustomer.id]?.status === "active" ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Set New Password</label>
                  <Input
                    type="password"
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  <p className="text-xs text-muted-foreground">This will immediately change the customer's login password.</p>
                </div>
              ) : dialogPortalStatuses[passwordResetCustomer.id]?.status === "pending" ? (
                <div className="text-sm text-muted-foreground">
                  <p>An invitation has been sent. The customer needs to complete registration using the invite link.</p>
                  <Button variant="outline" className="mt-3" onClick={() => handleInviteCustomer(passwordResetCustomer)}>
                    <UserPlus className="h-4 w-4 mr-2" />Resend Invitation
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>This customer does not have portal access. Send an invitation to allow them to access the payer portal.</p>
                  <Button variant="outline" className="mt-3" onClick={() => handleInviteCustomer(passwordResetCustomer)}>
                    <UserPlus className="h-4 w-4 mr-2" />Send Portal Invitation
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
            {dialogPortalStatuses[passwordResetCustomer?.id || ""]?.status === "active" && (
              <Button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 6} data-testid="button-reset-password">
                <KeyRound className="h-4 w-4 mr-2" />Reset Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeletionCheck(null); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-delete-customer">
          <DialogHeader>
            {deletionCheckLoading ? (
              <>
                <DialogTitle>Checking record…</DialogTitle>
                <DialogDescription>Verifying whether this customer can be permanently deleted.</DialogDescription>
              </>
            ) : deletionCheck?.canHardDelete ? (
              <>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Permanently Delete Customer
                </DialogTitle>
                <DialogDescription>
                  <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> has no linked records.
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
                  <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> has linked records and cannot be permanently deleted.
                  Archiving removes them from active lists while keeping all history intact.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {deletionCheckLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!deletionCheckLoading && deletionCheck && !deletionCheck.canHardDelete && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Linked records blocking deletion</p>
              {Object.entries(deletionCheck.linkedCounts)
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

          {!deletionCheckLoading && deletionCheck && !deletionCheck.canHardDelete && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Archived customers are hidden from all active lists. Their payments, invoices, and other records remain fully intact and accessible.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeletionCheck(null); }} data-testid="button-cancel-delete">
              Cancel
            </Button>
            {!deletionCheckLoading && deletionCheck?.canHardDelete && (
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</> : <><Trash2 className="h-4 w-4 mr-2" />Delete Permanently</>}
              </Button>
            )}
            {!deletionCheckLoading && deletionCheck && !deletionCheck.canHardDelete && (
              <Button
                onClick={() => deleteTarget && archiveMutation.mutate(deleteTarget.id)}
                disabled={archiveMutation.isPending}
                data-testid="button-confirm-archive"
              >
                {archiveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Archiving…</> : <><Archive className="h-4 w-4 mr-2" />Archive Customer</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
