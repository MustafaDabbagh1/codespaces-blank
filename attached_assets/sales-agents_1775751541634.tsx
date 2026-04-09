import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Mail,
  Phone,
  MoreHorizontal,
  Shield,
  CreditCard,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import type { SalesAgent } from "@shared/schema";

function getAgentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SalesAgentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SalesAgent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [liabilityAgentId, setLiabilityAgentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    name: "",
    email: "",
    phone: "",
    isActive: true,
    createLogin: false,
    loginEmail: "",
  });

  const { data: agents = [], isLoading } = useQuery<SalesAgent[]>({
    queryKey: ["/api/sales-agents"],
  });

  const { data: liabilityInvoices = [], isLoading: liabilityLoading } = useQuery<any[]>({
    queryKey: ["/api/sales-agents", liabilityAgentId, "liability-invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/sales-agents/${liabilityAgentId}/liability-invoices`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!liabilityAgentId,
  });

  const { data: agentBillingCard } = useQuery<any>({
    queryKey: ["/api/sales-agents", liabilityAgentId, "billing-card"],
    queryFn: async () => {
      const res = await fetch(`/api/sales-agents/${liabilityAgentId}/billing-card`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!liabilityAgentId,
  });

  const resetForm = () => {
    setFormData({
      companyName: "",
      name: "",
      email: "",
      phone: "",
      isActive: true,
      createLogin: false,
      loginEmail: "",
    });
    setEditingAgent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (agent: SalesAgent) => {
    setEditingAgent(agent);
    setFormData({
      companyName: agent.companyName || "",
      name: agent.name,
      email: agent.email || "",
      phone: agent.phone || "",
      isActive: agent.isActive,
      createLogin: false,
      loginEmail: "",
    });
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sales-agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-agents"] });
      toast({ title: "Sales agent created" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/sales-agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-agents"] });
      toast({ title: "Sales agent updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sales-agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-agents"] });
      toast({ title: "Sales agent deleted" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (formData.createLogin && !editingAgent && !formData.loginEmail.trim()) {
      toast({ title: "Login email is required when creating a portal login", variant: "destructive" });
      return;
    }
    if (editingAgent) {
      updateMutation.mutate({
        id: editingAgent.id,
        data: {
          companyName: formData.companyName || null,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          isActive: formData.isActive,
        },
      });
    } else {
      createMutation.mutate({
        companyName: formData.companyName || null,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        isActive: formData.isActive,
        createLogin: formData.createLogin,
        loginEmail: formData.loginEmail,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredAgents = agents.filter((agent) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(s) ||
      (agent.companyName?.toLowerCase().includes(s) ?? false) ||
      (agent.email?.toLowerCase().includes(s) ?? false) ||
      (agent.phone?.includes(s) ?? false)
    );
  });

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Sales Agents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your sales team and their portal access</p>
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-agent-count">
          {isLoading
            ? "Loading..."
            : `${filteredAgents.length} ${filteredAgents.length === 1 ? "agent" : "agents"}`}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm"
              data-testid="input-search-agents"
            />
          </div>
          <Button size="sm" className="h-8" onClick={openCreateDialog} data-testid="button-create-agent">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No sales agents yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first sales agent to start tracking customer assignments
                </p>
              </div>
              <Button size="sm" onClick={openCreateDialog} data-testid="button-create-agent-empty">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Sales Agent
              </Button>
            </div>
          ) : (
            <Table data-testid="table-agents">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Agent</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Contact</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Portal</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No agents match your search.
                    </TableCell>
                  </TableRow>
                ) : filteredAgents.map((agent) => (
                  <TableRow key={agent.id} className="hover-elevate" data-testid={`row-agent-${agent.id}`}>

                    {/* Agent: avatar + name (primary) + company (secondary) */}
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs font-semibold">
                            {getAgentInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span
                            className="text-sm font-semibold leading-tight text-foreground"
                            data-testid={`text-agent-name-${agent.id}`}
                          >
                            {agent.name}
                          </span>
                          {agent.companyName && (
                            <span
                              className="text-[11px] text-muted-foreground/70 truncate leading-tight"
                              data-testid={`text-agent-company-${agent.id}`}
                            >
                              {agent.companyName}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Contact: email primary, phone secondary */}
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-0.5">
                        {agent.email ? (
                          <span
                            className="text-sm flex items-center gap-1.5"
                            data-testid={`text-agent-email-${agent.id}`}
                          >
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            {agent.email}
                          </span>
                        ) : null}
                        {agent.phone ? (
                          <span
                            className="text-[11px] text-muted-foreground flex items-center gap-1.5"
                            data-testid={`text-agent-phone-${agent.id}`}
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            {agent.phone}
                          </span>
                        ) : null}
                        {!agent.email && !agent.phone && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Portal access */}
                    <TableCell className="py-3">
                      {agent.userId ? (
                        <Badge
                          variant="outline"
                          className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 font-normal"
                          data-testid={`badge-portal-${agent.id}`}
                        >
                          Has Login
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground font-normal"
                          data-testid={`badge-no-portal-${agent.id}`}
                        >
                          No Access
                        </Badge>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {agent.isActive ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 font-normal"
                          data-testid={`badge-active-${agent.id}`}
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground font-normal"
                          data-testid={`badge-inactive-${agent.id}`}
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            data-testid={`button-agent-actions-${agent.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(agent)}
                            data-testid={`button-edit-agent-${agent.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Agent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLiabilityAgentId(agent.id)}
                            data-testid={`button-liability-agent-${agent.id}`}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Liability & Billing
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(agent.id)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-agent-${agent.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Agent
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) { setShowDialog(false); resetForm(); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingAgent ? "Edit Sales Agent" : "Add Sales Agent"}
            </DialogTitle>
            <DialogDescription>
              {editingAgent
                ? "Update this agent's information and access settings."
                : "Add a new sales agent to your team. Optionally create a portal login."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">

            {/* Identity */}
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="agent-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
                data-testid="input-agent-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-company">Company</Label>
              <Input
                id="agent-company"
                value={formData.companyName}
                onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                placeholder="Organization or company name"
                data-testid="input-agent-company"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-email">Email</Label>
                <Input
                  id="agent-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="agent@example.com"
                  data-testid="input-agent-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-phone">Phone</Label>
                <Input
                  id="agent-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  data-testid="input-agent-phone"
                />
              </div>
            </div>

            {/* Active toggle — only when editing */}
            {editingAgent && (
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="agent-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
                  data-testid="switch-agent-active"
                />
                <Label htmlFor="agent-active">Active</Label>
              </div>
            )}

            {/* Portal login — only when creating */}
            {!editingAgent && (
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="create-login"
                    checked={formData.createLogin}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, createLogin: checked === true }))
                    }
                    data-testid="checkbox-create-login"
                  />
                  <Label htmlFor="create-login" className="cursor-pointer font-normal">
                    Create portal login for this agent
                  </Label>
                </div>
                {formData.createLogin && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="login-email">Login Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={formData.loginEmail}
                      onChange={(e) => setFormData((p) => ({ ...p, loginEmail: e.target.value }))}
                      placeholder="agent@example.com"
                      data-testid="input-login-email"
                    />
                    <p className="text-xs text-muted-foreground">
                      An invitation email will be sent with temporary login credentials.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowDialog(false); resetForm(); }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-agent">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAgent ? "Save Changes" : "Add Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the agent from your team. Any customers assigned to this agent
              will keep their assignment but it won't link to an agent record anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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

      <Dialog open={!!liabilityAgentId} onOpenChange={(open) => { if (!open) setLiabilityAgentId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-admin-liability">
          <DialogHeader>
            <DialogTitle>
              Liability & Billing — {agents.find(a => a.id === liabilityAgentId)?.name || "Agent"}
            </DialogTitle>
            <DialogDescription>
              View this agent's billing method and liability invoices from failed recurring payments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase mb-0.5">Billing Method</p>
                {agentBillingCard ? (
                  <p className="text-sm font-semibold" data-testid="text-admin-card-info">
                    {agentBillingCard.cardBrand || "Card"} •••• {agentBillingCard.last4}
                    <span className="text-xs text-muted-foreground ml-2">
                      Expires {agentBillingCard.expMonth}/{agentBillingCard.expYear}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium" data-testid="text-admin-no-card">
                    No billing method on file
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3">Liability Invoices</h4>
              {liabilityLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : liabilityInvoices.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No liability invoices for this agent.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Charge Result</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liabilityInvoices.map((inv: any) => {
                      const customerName = inv.customerName || (inv.customerId ? "Customer" : "—");
                      return (
                        <TableRow
                          key={inv.id}
                          className={inv.status !== "paid" && inv.status !== "cancelled" ? "bg-red-50/50 dark:bg-red-900/5" : ""}
                          data-testid={`row-admin-liability-${inv.id}`}
                        >
                          <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                          <TableCell className="text-sm">{customerName}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-sm">
                            ${parseFloat(inv.totalAmount || "0").toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                inv.status === "paid" ? "border-green-300 text-green-700 dark:text-green-400" :
                                inv.status === "cancelled" ? "text-muted-foreground" :
                                "border-red-300 text-red-700 dark:text-red-400"
                              }`}
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.chargeResult === "success" ? (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:text-green-400">Charged</Badge>
                            ) : inv.chargeResult === "voided_customer_paid" ? (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-400">Cancelled</Badge>
                            ) : inv.chargeResult === "no_billing_method" ? (
                              <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 dark:text-yellow-400">No Card</Badge>
                            ) : inv.chargeResult ? (
                              <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:text-red-400">Failed</Badge>
                            ) : (
                              <span>Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.createdAt ? format(new Date(inv.createdAt), "MMM d, yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
