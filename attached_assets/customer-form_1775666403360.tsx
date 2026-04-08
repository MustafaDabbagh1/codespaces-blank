import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export function CustomerFormFields({ defaults }: { defaults?: any }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First Name *</Label><Input name="firstName" required defaultValue={defaults?.firstName || ""} data-testid="input-first-name" /></div>
        <div><Label>Last Name *</Label><Input name="lastName" required defaultValue={defaults?.lastName || ""} data-testid="input-last-name" /></div>
      </div>
      <div><Label>Email</Label><Input name="email" type="email" defaultValue={defaults?.email || ""} data-testid="input-email" /></div>
      <div><Label>Phone</Label><Input name="phone" defaultValue={defaults?.phone || ""} data-testid="input-phone" /></div>
      <div><Label>Address</Label><Input name="address" defaultValue={defaults?.address || ""} data-testid="input-address" /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>City</Label><Input name="city" defaultValue={defaults?.city || ""} data-testid="input-city" /></div>
        <div><Label>State</Label><Input name="state" defaultValue={defaults?.state || ""} data-testid="input-state" /></div>
        <div><Label>ZIP</Label><Input name="zip" defaultValue={defaults?.zip || ""} data-testid="input-zip" /></div>
      </div>
      <div><Label>Notes</Label><Textarea name="notes" defaultValue={defaults?.notes || ""} data-testid="input-notes" /></div>
      <div className="space-y-2">
        <div className="flex items-center gap-3"><Switch name="emailReceipts" id="er" defaultChecked={defaults?.emailReceipts !== false} /><Label htmlFor="er">Email receipts</Label></div>
        <div className="flex items-center gap-3"><Switch name="emailTicketUpdates" id="etu" defaultChecked={defaults?.emailTicketUpdates !== false} /><Label htmlFor="etu">Email ticket updates</Label></div>
      </div>
    </>
  );
}

export function parseCustomerFormData(fd: FormData) {
  return {
    firstName: fd.get("firstName"),
    lastName: fd.get("lastName"),
    email: fd.get("email") || null,
    phone: fd.get("phone") || null,
    address: fd.get("address") || null,
    city: fd.get("city") || null,
    state: fd.get("state") || null,
    zip: fd.get("zip") || null,
    notes: fd.get("notes") || null,
    emailReceipts: fd.get("emailReceipts") === "on",
    emailTicketUpdates: fd.get("emailTicketUpdates") === "on",
  };
}
