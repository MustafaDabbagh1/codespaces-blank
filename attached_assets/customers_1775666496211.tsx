import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import MerchantLayout from "@/components/merchant-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Loader2, Pencil, Store, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { CustomerFormFields, parseCustomerFormData } from "@/components/customer-form";

const parseFormData = parseCustomerFormData;

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const { user } = useAuth();
  const canEdit = user?.merchantRole === "owner" || user?.merchantRole === "manager" || user?.merchantRole === "cashier";

  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/merchant/customers"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/merchant/customers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/customers"] });
      setCreateOpen(false);
      toast({ title: "Customer created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/merchant/customers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/customers"] });
      setEditCustomer(null);
      toast({ title: "Customer updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = customers.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.firstName.toLowerCase().includes(s) || c.lastName.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) || c.phone?.includes(s);
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMutation.mutate(parseFormData(new FormData(e.currentTarget)));
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCustomer) return;
    editMutation.mutate({ id: editCustomer.id, data: parseFormData(new FormData(e.currentTarget)) });
  };

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{customers.length} customers</p>
              <span className="text-xs text-muted-foreground/70 flex items-center gap-1"><Store className="w-3 h-3" />Shared across all stores</span>
            </div>
          </div>
          {canEdit && <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-customer"><Plus className="w-4 h-4 mr-2" /> Add Customer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <CustomerFormFields />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-customer">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Customer
                </Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-customers" />
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                ) : (
                  filtered.map((c: any) => {
                    const initials = `${(c.firstName?.[0] || "").toUpperCase()}${(c.lastName?.[0] || "").toUpperCase()}`;
                    return (
                    <TableRow key={c.id} className="cursor-pointer group" onClick={() => navigate(`/app/customers/${c.id}`)} data-testid={`row-customer-${c.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials}
                          </div>
                          <span className="font-semibold text-sm text-primary">{c.firstName} {c.lastName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          {c.email && <span className="text-muted-foreground truncate max-w-[200px]">{c.email}</span>}
                          {c.phone && <span className="text-xs">{c.phone}</span>}
                          {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.createdAt ? format(new Date(c.createdAt), "MMM d, yyyy") : ""}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditCustomer(c); }} data-testid={`button-edit-customer-${c.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
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

        <Dialog open={!!editCustomer} onOpenChange={(open) => { if (!open) setEditCustomer(null); }}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
            {editCustomer && (
              <form onSubmit={handleEdit} className="space-y-4" key={editCustomer.id}>
                <CustomerFormFields defaults={editCustomer} />
                <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-update-customer">
                  {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MerchantLayout>
  );
}
