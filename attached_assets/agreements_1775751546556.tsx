import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agreement, AgreementAuditEntry, AgreementTemplate, SalesAgent } from "@shared/schema";
import PdfFieldEditor, { type SignatureField, type FieldType, getFieldConfig, getFieldBadgeColor } from "@/components/pdf-field-editor";
import {
  Plus,
  Send,
  Eye,
  Trash2,
  FileSignature,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  Mail,
  Globe,
  Calendar,
  FileUp,
  Copy,
  Pencil,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Lock,
  GripVertical,
  Layers,
  X,
  RefreshCw,
  MoreHorizontal,
  Search,
  Filter,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="font-normal text-muted-foreground" data-testid={`badge-status-${status}`}>Draft</Badge>;
    case "sent":
      return <Badge variant="outline" className="border-blue-300 text-blue-700 font-normal" data-testid={`badge-status-${status}`}>Sent</Badge>;
    case "viewed":
      return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50/60 font-normal" data-testid={`badge-status-${status}`}>Awaiting Signature</Badge>;
    case "signed":
      return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-normal" data-testid={`badge-status-${status}`}>Signed</Badge>;
    case "declined":
      return <Badge variant="destructive" className="font-normal" data-testid={`badge-status-${status}`}>Declined</Badge>;
    case "expired":
      return <Badge variant="outline" className="text-muted-foreground font-normal" data-testid={`badge-status-${status}`}>Expired</Badge>;
    default:
      return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}

function actionIcon(action: string) {
  switch (action) {
    case "created": return <FileSignature className="h-4 w-4 text-blue-500" />;
    case "sent": return <Send className="h-4 w-4 text-blue-500" />;
    case "viewed": return <Eye className="h-4 w-4 text-amber-500" />;
    case "signed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "declined": return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

interface AgreementsPageProps {
  apiPrefix?: string;
}

export default function AgreementsPage({ apiPrefix = "/api" }: AgreementsPageProps) {
  const isAgent = apiPrefix !== "/api";
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewAgreement, setViewAgreement] = useState<Agreement | null>(null);
  const [auditTrail, setAuditTrail] = useState<AgreementAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [multiTemplateMode, setMultiTemplateMode] = useState(false);

  const [templateCreateOpen, setTemplateCreateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateSharedWithAgents, setTemplateSharedWithAgents] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [editFieldsTemplate, setEditFieldsTemplate] = useState<AgreementTemplate | null>(null);
  const [editDetailsTemplate, setEditDetailsTemplate] = useState<AgreementTemplate | null>(null);
  const [editDetailsName, setEditDetailsName] = useState("");
  const [editDetailsDescription, setEditDetailsDescription] = useState("");
  const [editDetailsShared, setEditDetailsShared] = useState(true);
  const replacePdfInputRef = useRef<HTMLInputElement>(null);
  const [replacePdfTemplateId, setReplacePdfTemplateId] = useState<string | null>(null);
  const [prefillValues, setPrefillValues] = useState<Record<string, string>>({});
  const [editEmailAgreement, setEditEmailAgreement] = useState<Agreement | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [pdfViewAgreement, setPdfViewAgreement] = useState<Agreement | null>(null);
  const [pdfViewPage, setPdfViewPage] = useState(1);
  const [pdfViewNumPages, setPdfViewNumPages] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewNumPages, setPreviewNumPages] = useState(1);
  const [previewContainerHeight, setPreviewContainerHeight] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  });

  const { data: agreements = [], isLoading } = useQuery<Agreement[]>({
    queryKey: [`${apiPrefix}/agreements`],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<AgreementTemplate[]>({
    queryKey: [`${apiPrefix}/agreement-templates`],
  });

  const { data: salesAgents = [] } = useQuery<SalesAgent[]>({
    queryKey: ["/api/sales-agents"],
    enabled: !isAgent,
  });

  const agentUserIds = new Set(salesAgents.filter(a => a.userId).map(a => a.userId!));

  const [agreementSearch, setAgreementSearch] = useState("");
  const [agreementStatusFilter, setAgreementStatusFilter] = useState("all");

  const filteredAgreements = useMemo(() => {
    return agreements.filter((ag) => {
      if (agreementStatusFilter !== "all" && ag.status !== agreementStatusFilter) return false;
      if (!agreementSearch) return true;
      const s = agreementSearch.toLowerCase();
      return (
        ag.title.toLowerCase().includes(s) ||
        ag.recipientName.toLowerCase().includes(s) ||
        ag.recipientEmail.toLowerCase().includes(s)
      );
    });
  }, [agreements, agreementSearch, agreementStatusFilter]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedTemplates = selectedTemplateIds.map(id => templates.find(t => t.id === id)).filter(Boolean) as AgreementTemplate[];

  function getTemplateFields(tpl: AgreementTemplate): { fields: SignatureField[]; sections: string[] } {
    try {
      const raw = JSON.parse(tpl.signatureFields || "[]");
      if (raw.length > 0 && raw[0]?.__sectionsMeta) {
        return { fields: raw.slice(1), sections: raw[0].sections || [] };
      }
      return { fields: raw, sections: [] };
    } catch { return { fields: [], sections: [] }; }
  }

  const buildCreateBody = () => {
    const body: Record<string, unknown> = {
      title,
      recipientName,
      recipientEmail,
    };

    if (useTemplate && multiTemplateMode && selectedTemplateIds.length > 0) {
      body.content = "See attached PDF agreement";
      body.templateIds = selectedTemplateIds;
      body.prefillValues = prefillValues;

      for (const tpl of selectedTemplates) {
        const { fields } = getTemplateFields(tpl);
        const senderRequired = fields.filter((f: SignatureField) => f.filledBy === "sender" && f.required && f.type !== "signature" && f.type !== "initials");
        const missingSender = senderRequired.filter((f: SignatureField) => {
          const nsKey = `${tpl.id}:${f.id}`;
          return !(prefillValues[nsKey] || f.prefillValue)?.trim();
        });
        if (missingSender.length > 0) {
          throw new Error(`Please fill in sender fields for "${tpl.name}": ${missingSender.map((f: SignatureField) => f.label).join(", ")}`);
        }
        const invalidSenderEmails = fields.filter((f: SignatureField) => {
          if (f.filledBy !== "sender" || f.fieldType !== "email") return false;
          const nsKey = `${tpl.id}:${f.id}`;
          const val = (prefillValues[nsKey] || f.prefillValue || "").trim();
          return !!val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        });
        if (invalidSenderEmails.length > 0) {
          throw new Error(`Invalid email address in "${tpl.name}": ${invalidSenderEmails.map((f: SignatureField) => f.label).join(", ")}`);
        }
      }
    } else if (useTemplate && selectedTemplate) {
      body.content = "See attached PDF agreement";
      body.templateId = selectedTemplate.id;
      body.pdfUrl = selectedTemplate.pdfUrl;
      let rawParsed: any[] = [];
      try { rawParsed = JSON.parse(selectedTemplate.signatureFields || "[]"); } catch { rawParsed = []; }
      let sectionsMeta: any = null;
      let templateFields: SignatureField[] = [];
      if (rawParsed.length > 0 && rawParsed[0]?.__sectionsMeta) {
        sectionsMeta = rawParsed[0];
        templateFields = rawParsed.slice(1) as SignatureField[];
      } else {
        templateFields = rawParsed as SignatureField[];
      }

      const senderRequired = templateFields.filter((f: SignatureField) => f.filledBy === "sender" && f.required && f.type !== "signature" && f.type !== "initials");
      const missingSender = senderRequired.filter((f: SignatureField) => !(prefillValues[f.id] || f.prefillValue)?.trim());
      if (missingSender.length > 0) {
        throw new Error(`Please fill in all sender fields: ${missingSender.map((f: SignatureField) => f.label).join(", ")}`);
      }
      const invalidSenderEmails = templateFields.filter((f: SignatureField) => {
        if (f.filledBy !== "sender" || f.fieldType !== "email") return false;
        const val = (prefillValues[f.id] || f.prefillValue || "").trim();
        return !!val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      });
      if (invalidSenderEmails.length > 0) {
        throw new Error(`Invalid email address for: ${invalidSenderEmails.map((f: SignatureField) => f.label).join(", ")}`);
      }

      const fieldsWithPrefill = templateFields.map((f: SignatureField) => ({
        ...f,
        prefillValue: prefillValues[f.id] || f.prefillValue || undefined,
      }));
      const savePayload = sectionsMeta ? [sectionsMeta, ...fieldsWithPrefill] : fieldsWithPrefill;
      body.signatureFields = JSON.stringify(savePayload);
    } else {
      body.content = content;
    }
    return body;
  };

  const resetCreateForm = () => {
    setCreateOpen(false);
    setTitle("");
    setContent("");
    setRecipientName("");
    setRecipientEmail("");
    setUseTemplate(false);
    setSelectedTemplateId("");
    setSelectedTemplateIds([]);
    setMultiTemplateMode(false);
    setPrefillValues({});
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = buildCreateBody();
      const res = await apiRequest("POST", `${apiPrefix}/agreements`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      resetCreateForm();
      toast({ title: "Agreement created", description: "You can now review and send it." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createAndSendMutation = useMutation({
    mutationFn: async () => {
      const body = buildCreateBody();
      const res = await apiRequest("POST", `${apiPrefix}/agreements`, body);
      const created = await res.json();
      await apiRequest("POST", `${apiPrefix}/agreements/${created.id}/send`);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      resetCreateForm();
      toast({ title: "Agreement created & sent", description: "The recipient will receive an email with a signing link." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `${apiPrefix}/agreements/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      toast({ title: "Agreement sent", description: "The recipient will receive an email with a signing link." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiPrefix}/agreements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      setDeleteId(null);
      toast({ title: "Agreement deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `${apiPrefix}/agreements/${id}/resend`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      toast({ title: "Agreement resent", description: "The signing link has been emailed again." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: async ({ id, recipientEmail }: { id: string; recipientEmail: string }) => {
      const res = await apiRequest("PATCH", `${apiPrefix}/agreements/${id}/recipient`, { recipientEmail });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      setEditEmailAgreement(null);
      setEditEmailValue("");
      toast({ title: "Email updated", description: "Recipient email has been updated. You can now resend the agreement." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const loadAuditTrail = async (agreement: Agreement) => {
    setViewAgreement(agreement);
    setAuditLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/agreements/${agreement.id}/audit-trail`, { credentials: "include" });
      if (res.ok) {
        const trail = await res.json();
        setAuditTrail(trail);
      }
    } catch {
      setAuditTrail([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("name", templateName);
      if (templateDescription) formData.append("description", templateDescription);
      if (templateFile) formData.append("pdf", templateFile);
      formData.append("sharedWithAgents", String(templateSharedWithAgents));
      const res = await fetch(`${apiPrefix}/agreement-templates`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      setTemplateCreateOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateFile(null);
      setTemplateSharedWithAgents(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Template created", description: "You can now edit signature fields." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const replacePdfMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch(`${apiPrefix}/agreement-templates/${id}/replace-pdf`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to replace PDF");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      setReplacePdfTemplateId(null);
      if (replacePdfInputRef.current) replacePdfInputRef.current.value = "";
      toast({ title: "PDF replaced", description: "Template PDF has been updated. Existing fields are preserved — verify their positions on the new document." });
    },
    onError: (err: Error) => {
      if (replacePdfInputRef.current) replacePdfInputRef.current.value = "";
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cloneTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiPrefix}/agreement-templates/${id}/clone`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Failed to clone template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      toast({ title: "Template cloned", description: "A copy of the template has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiPrefix}/agreement-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      setDeleteTemplateId(null);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async ({ id, name, description, sharedWithAgents }: { id: string; name: string; description: string; sharedWithAgents: boolean }) => {
      await apiRequest("PATCH", `${apiPrefix}/agreement-templates/${id}`, { name, description, sharedWithAgents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      setEditDetailsTemplate(null);
      toast({ title: "Template updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateFieldsMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: unknown[] }) => {
      const res = await apiRequest("PATCH", `${apiPrefix}/agreement-templates/${id}`, {
        signatureFields: JSON.stringify(fields),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreement-templates`] });
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/agreements`] });
      setEditFieldsTemplate(null);
      toast({ title: "Signature fields saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveFields = (templateId: string, fields: unknown[]) => {
    updateFieldsMutation.mutate({ id: templateId, fields });
  };

  const canCreateAgreement = useTemplate
    ? multiTemplateMode
      ? title.trim() && selectedTemplateIds.length > 0 && recipientName.trim() && recipientEmail.trim()
      : title.trim() && selectedTemplateId && recipientName.trim() && recipientEmail.trim()
    : title.trim() && content.trim() && recipientName.trim() && recipientEmail.trim();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Agreements</h1>
          <p className="text-muted-foreground text-sm">Send agreements for electronic signature with full audit trail</p>
        </div>
      </div>

      <Tabs defaultValue="agreements" data-testid="tabs-agreements">
        {!isAgent && (
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="agreements" data-testid="tab-agreements">Agreements</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="agreements" className="space-y-4">
          <div className={isAgent ? "flex items-center justify-between gap-3" : "flex justify-end"}>
            {isAgent && (
              <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-agreement-count">
                {filteredAgreements.length} {filteredAgreements.length === 1 ? "agreement" : "agreements"}
              </span>
            )}
            <div className={isAgent ? "flex items-center gap-2" : ""}>
              {isAgent && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search agreements..."
                      className="pl-8 h-8 w-52 text-sm"
                      value={agreementSearch}
                      onChange={(e) => setAgreementSearch(e.target.value)}
                      data-testid="input-search-agreements"
                    />
                  </div>
                  <Select value={agreementStatusFilter} onValueChange={setAgreementStatusFilter}>
                    <SelectTrigger className="h-8 w-44 text-sm" data-testid="select-status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="viewed">Awaiting Signature</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (open && isAgent) setUseTemplate(true); }}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-agreement">
                  <Plus className="h-4 w-4 mr-2" />
                  {isAgent ? "Send Agreement" : "New Agreement"}
                </Button>
              </DialogTrigger>
              <DialogContent className={`${(useTemplate && (selectedTemplate || selectedTemplates.length > 0)) ? "max-w-[95vw] w-full h-[90vh]" : "max-w-2xl max-h-[85vh]"} flex flex-col overflow-hidden`}>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Create Agreement</DialogTitle>
                </DialogHeader>
                {(() => {
                  const previewTemplate = useTemplate
                    ? (multiTemplateMode ? (selectedTemplates.length > 0 ? selectedTemplates[0] : null) : selectedTemplate || null)
                    : null;
                  const hasPreview = !!previewTemplate?.pdfUrl;

                  const previewFields = previewTemplate ? (() => {
                    const { fields } = getTemplateFields(previewTemplate);
                    return fields.filter((f: SignatureField) => f.page === previewPage);
                  })() : [];

                  const fieldTypeColors: Record<string, string> = {
                    signature: "border-blue-500 bg-blue-50/80 dark:bg-blue-950/50",
                    initials: "border-violet-500 bg-violet-50/80 dark:bg-violet-950/50",
                    date: "border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/50",
                    text: "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50",
                    full_name: "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50",
                    first_name: "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50",
                    last_name: "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50",
                    email: "border-teal-500 bg-teal-50/80 dark:bg-teal-950/50",
                    phone: "border-pink-500 bg-pink-50/80 dark:bg-pink-950/50",
                    business_name: "border-orange-500 bg-orange-50/80 dark:bg-orange-950/50",
                    title: "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/50",
                    checkbox: "border-gray-500 bg-gray-50/80 dark:bg-gray-950/50",
                    dropdown: "border-amber-500 bg-amber-50/80 dark:bg-amber-950/50",
                  };

                  const formContent = (
                    <div className="space-y-4">
                      {!isAgent && (
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={useTemplate}
                            onCheckedChange={(checked) => {
                              setUseTemplate(checked);
                              if (!checked) {
                                setSelectedTemplateId("");
                                setSelectedTemplateIds([]);
                                setMultiTemplateMode(false);
                              }
                            }}
                            data-testid="switch-use-template"
                          />
                          <Label>From Template</Label>
                        </div>
                      )}

                      {useTemplate && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>{multiTemplateMode ? "Select Templates" : "Select Template"}</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => {
                                setMultiTemplateMode(!multiTemplateMode);
                                if (!multiTemplateMode) {
                                  if (selectedTemplateId) {
                                    setSelectedTemplateIds([selectedTemplateId]);
                                  }
                                } else {
                                  if (selectedTemplateIds.length === 1) {
                                    setSelectedTemplateId(selectedTemplateIds[0]);
                                  }
                                  setSelectedTemplateIds([]);
                                }
                              }}
                              data-testid="button-toggle-multi-template"
                            >
                              <Layers className="h-3.5 w-3.5" />
                              {multiTemplateMode ? "Single Template" : "Combine Templates"}
                            </Button>
                          </div>

                          {!multiTemplateMode ? (
                            <>
                              <Select value={selectedTemplateId} onValueChange={(val) => {
                                setSelectedTemplateId(val);
                                setPreviewPage(1);
                                setPreviewNumPages(1);
                                const tpl = templates.find((t) => t.id === val);
                                if (tpl) setTitle(tpl.name);
                              }}>
                                <SelectTrigger data-testid="select-template">
                                  <SelectValue placeholder="Choose a template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {templates.map((tpl) => (
                                    <SelectItem key={tpl.id} value={tpl.id} data-testid={`select-template-option-${tpl.id}`}>
                                      {tpl.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedTemplate && (() => {
                                const { fields: tplFields, sections: tplSections } = getTemplateFields(selectedTemplate);
                                const senderFields = tplFields.filter((f: SignatureField) => f.filledBy === "sender" && f.type !== "signature" && f.type !== "initials");
                                const recipientFields = tplFields.filter((f: SignatureField) => f.filledBy !== "sender" && f.type !== "signature" && f.type !== "initials");

                                const groupBySection = (fields: SignatureField[]) => {
                                  const groups: { section: string | null; fields: SignatureField[] }[] = [];
                                  const sectionOrder = tplSections.length > 0 ? tplSections : [];
                                  for (const sec of sectionOrder) {
                                    const secFields = fields.filter((f) => f.section === sec);
                                    if (secFields.length > 0) groups.push({ section: sec, fields: secFields });
                                  }
                                  const unsectioned = fields.filter((f) => !f.section || !sectionOrder.includes(f.section));
                                  if (unsectioned.length > 0) groups.push({ section: null, fields: unsectioned });
                                  return groups;
                                };

                                const isDropdownType = (f: SignatureField) => f.type === "dropdown" || f.fieldType === "dropdown";
                                const isCheckboxType = (f: SignatureField) => f.type === "checkbox" || f.fieldType === "checkbox";
                                const getFieldOptions = (f: SignatureField): string[] => {
                                  if (f.options && f.options.length > 0) return f.options;
                                  return [];
                                };

                                const renderPrefillField = (field: SignatureField, variant: "sender" | "recipient", keyPrefix = "") => {
                                  const fieldKey = keyPrefix ? `${keyPrefix}:${field.id}` : field.id;
                                  const isSender = variant === "sender";
                                  const labelEl = (
                                    <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                                      {field.label}{isSender && field.required && <span className="text-red-500">*</span>}
                                      <Badge variant="secondary" className={`text-[9px] ${getFieldBadgeColor(field.type, field.fieldType)}`}>
                                        {getFieldConfig(field.type).label}
                                      </Badge>
                                    </Label>
                                  );

                                  if (isDropdownType(field)) {
                                    const opts = getFieldOptions(field);
                                    return (
                                      <div key={field.id}>
                                        {labelEl}
                                        <Select
                                          value={prefillValues[fieldKey] || field.prefillValue || ""}
                                          onValueChange={(val) => setPrefillValues((prev) => ({ ...prev, [fieldKey]: val }))}
                                        >
                                          <SelectTrigger className={isSender ? "h-8 text-sm" : "h-7 text-xs"} data-testid={`select-prefill-${field.id}`}>
                                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {opts.map((opt) => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    );
                                  }

                                  if (isCheckboxType(field)) {
                                    const isChecked = (prefillValues[fieldKey] || field.prefillValue || "false") === "true";
                                    return (
                                      <div
                                        key={field.id}
                                        className="flex items-center gap-2.5 py-1 cursor-pointer rounded hover:bg-muted/40 px-1 transition-colors"
                                        onClick={() => setPrefillValues((prev) => ({ ...prev, [fieldKey]: isChecked ? "false" : "true" }))}
                                        data-testid={`checkbox-prefill-${field.id}`}
                                      >
                                        {isChecked ? (
                                          <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                        ) : (
                                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="text-xs font-medium">{field.label}</span>
                                      </div>
                                    );
                                  }

                                  const prefillInputType = (field.fieldType === "email") ? "email" : (field.fieldType === "date") ? "date" : "text";
                                  return (
                                    <div key={field.id}>
                                      {labelEl}
                                      <Input
                                        type={prefillInputType}
                                        className={isSender ? "h-8 text-sm" : "h-7 text-xs"}
                                        value={prefillValues[fieldKey] || field.prefillValue || ""}
                                        onChange={(e) => setPrefillValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                                        placeholder={isSender ? `Enter ${field.label.toLowerCase()}...` : `${field.label}...`}
                                        data-testid={isSender ? `input-sender-field-${field.id}` : `input-prefill-${field.id}`}
                                      />
                                    </div>
                                  );
                                };

                                const renderFieldGroups = (groups: { section: string | null; fields: SignatureField[] }[], variant: "sender" | "recipient") => {
                                  return groups.map((group, gi) => (
                                    <div key={group.section || `unsectioned-${gi}`}>
                                      {group.section && (
                                        <p className={`text-[10px] font-semibold uppercase tracking-wider mt-2 mb-1 ${variant === "sender" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                          {group.section}
                                        </p>
                                      )}
                                      <div className="space-y-2">
                                        {group.fields.map((field: SignatureField) => renderPrefillField(field, variant))}
                                      </div>
                                    </div>
                                  ));
                                };

                                return (
                                  <>
                                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                      <FileUp className="h-4 w-4" />
                                      <span>{selectedTemplate.pdfOriginalName || "PDF attached"}</span>
                                      <Badge variant="secondary" className="ml-2">
                                        {tplFields.length} fields
                                      </Badge>
                                    </div>
                                    {senderFields.length > 0 && (
                                      <div className="mt-3 border rounded-md p-3 space-y-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                          <Building2 className="h-3.5 w-3.5" />
                                          Your Fields to Complete
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400">These fields will be locked and visible to the signer on the document.</p>
                                        <div className="space-y-1">
                                          {renderFieldGroups(groupBySection(senderFields), "sender")}
                                        </div>
                                      </div>
                                    )}
                                    {recipientFields.length > 0 && (
                                      <div className="mt-3 border rounded-md p-3 space-y-2 bg-muted/20">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prefill Recipient Fields (optional)</p>
                                        <p className="text-xs text-muted-foreground mb-2">Pre-fill values for the signer. They can still edit these.</p>
                                        <div className="space-y-1">
                                          {renderFieldGroups(groupBySection(recipientFields), "recipient")}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                                {templates.map((tpl) => {
                                  const isSelected = selectedTemplateIds.includes(tpl.id);
                                  const { fields } = getTemplateFields(tpl);
                                  return (
                                    <div
                                      key={tpl.id}
                                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedTemplateIds(prev => prev.filter(id => id !== tpl.id));
                                        } else {
                                          setSelectedTemplateIds(prev => [...prev, tpl.id]);
                                          setPreviewPage(1);
                                          setPreviewNumPages(1);
                                        }
                                      }}
                                      data-testid={`multi-template-option-${tpl.id}`}
                                    >
                                      <div className="flex-shrink-0">
                                        {isSelected ? (
                                          <CheckSquare className="h-4 w-4 text-primary" />
                                        ) : (
                                          <Square className="h-4 w-4 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{tpl.name}</p>
                                        {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                                      </div>
                                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                        {fields.length} fields
                                      </Badge>
                                    </div>
                                  );
                                })}
                                {templates.length === 0 && (
                                  <div className="p-4 text-center text-sm text-muted-foreground">No templates available</div>
                                )}
                              </div>

                              {selectedTemplateIds.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                      <Layers className="h-3.5 w-3.5" />
                                      Document Order ({selectedTemplateIds.length} templates)
                                    </p>
                                  </div>
                                  <div className="border rounded-lg divide-y">
                                    {selectedTemplateIds.map((tplId, idx) => {
                                      const tpl = templates.find(t => t.id === tplId);
                                      if (!tpl) return null;
                                      return (
                                        <div key={tplId} className="flex items-center gap-2 px-3 py-2" data-testid={`multi-template-order-${idx}`}>
                                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                                          <span className="text-sm flex-1 truncate">{tpl.name}</span>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                              disabled={idx === 0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTemplateIds(prev => {
                                                  const arr = [...prev];
                                                  [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                                  return arr;
                                                });
                                              }}
                                              data-testid={`button-move-up-${idx}`}
                                            >
                                              <ChevronUp className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                              disabled={idx === selectedTemplateIds.length - 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTemplateIds(prev => {
                                                  const arr = [...prev];
                                                  [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                                  return arr;
                                                });
                                              }}
                                              data-testid={`button-move-down-${idx}`}
                                            >
                                              <ChevronDown className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTemplateIds(prev => prev.filter(id => id !== tplId));
                                              }}
                                              data-testid={`button-remove-template-${idx}`}
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {selectedTemplates.length > 0 && (() => {
                                const allSenderFields: { tpl: AgreementTemplate; field: SignatureField }[] = [];
                                const allRecipientFields: { tpl: AgreementTemplate; field: SignatureField }[] = [];
                                for (const tpl of selectedTemplates) {
                                  const { fields } = getTemplateFields(tpl);
                                  for (const f of fields) {
                                    if (f.type === "signature" || f.type === "initials") continue;
                                    if (f.filledBy === "sender") {
                                      allSenderFields.push({ tpl, field: f });
                                    } else {
                                      allRecipientFields.push({ tpl, field: f });
                                    }
                                  }
                                }

                                return (
                                  <>
                                    {allSenderFields.length > 0 && (
                                      <div className="border rounded-md p-3 space-y-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                          <Building2 className="h-3.5 w-3.5" />
                                          Your Fields to Complete
                                        </p>
                                        <div className="space-y-3">
                                          {selectedTemplates.map(tpl => {
                                            const tplSenderFields = allSenderFields.filter(sf => sf.tpl.id === tpl.id);
                                            if (tplSenderFields.length === 0) return null;
                                            return (
                                              <div key={tpl.id}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">{tpl.name}</p>
                                                <div className="space-y-2">
                                                  {tplSenderFields.map(({ field, tpl: fieldTpl }) => {
                                                    const nsKey = `${fieldTpl.id}:${field.id}`;
                                                    const isDropdown = field.type === "dropdown" || field.fieldType === "dropdown";
                                                    const isCheckbox = field.type === "checkbox" || field.fieldType === "checkbox";

                                                    if (isDropdown) {
                                                      const opts = field.options && field.options.length > 0 ? field.options : [];
                                                      return (
                                                        <div key={nsKey}>
                                                          <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                                                            {field.label}{field.required && <span className="text-red-500">*</span>}
                                                            <Badge variant="secondary" className={`text-[9px] ${getFieldBadgeColor(field.type, field.fieldType)}`}>
                                                              {getFieldConfig(field.type).label}
                                                            </Badge>
                                                          </Label>
                                                          <Select
                                                            value={prefillValues[nsKey] || field.prefillValue || ""}
                                                            onValueChange={(val) => setPrefillValues((prev) => ({ ...prev, [nsKey]: val }))}
                                                          >
                                                            <SelectTrigger className="h-8 text-sm" data-testid={`select-multi-sender-${nsKey}`}>
                                                              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              {opts.map((opt) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                              ))}
                                                            </SelectContent>
                                                          </Select>
                                                        </div>
                                                      );
                                                    }

                                                    if (isCheckbox) {
                                                      const isChecked = (prefillValues[nsKey] || field.prefillValue || "false") === "true";
                                                      return (
                                                        <div
                                                          key={nsKey}
                                                          className="flex items-center gap-2.5 py-1 cursor-pointer rounded hover:bg-muted/40 px-1 transition-colors"
                                                          onClick={() => setPrefillValues((prev) => ({ ...prev, [nsKey]: isChecked ? "false" : "true" }))}
                                                          data-testid={`checkbox-multi-sender-${nsKey}`}
                                                        >
                                                          {isChecked ? (
                                                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                                          ) : (
                                                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                                          )}
                                                          <span className="text-xs font-medium">{field.label}</span>
                                                        </div>
                                                      );
                                                    }

                                                    const multiSenderInputType = (field.fieldType === "email") ? "email" : (field.fieldType === "date") ? "date" : "text";
                                                    return (
                                                    <div key={nsKey}>
                                                      <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                                                        {field.label}{field.required && <span className="text-red-500">*</span>}
                                                        <Badge variant="secondary" className={`text-[9px] ${getFieldBadgeColor(field.type, field.fieldType)}`}>
                                                          {getFieldConfig(field.type).label}
                                                        </Badge>
                                                      </Label>
                                                      <Input
                                                        type={multiSenderInputType}
                                                        className="h-8 text-sm"
                                                        value={prefillValues[nsKey] || field.prefillValue || ""}
                                                        onChange={(e) => setPrefillValues((prev) => ({ ...prev, [nsKey]: e.target.value }))}
                                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                        data-testid={`input-multi-sender-field-${nsKey}`}
                                                      />
                                                    </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {allRecipientFields.length > 0 && (
                                      <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prefill Recipient Fields (optional)</p>
                                        <div className="space-y-3">
                                          {selectedTemplates.map(tpl => {
                                            const tplRecipientFields = allRecipientFields.filter(sf => sf.tpl.id === tpl.id);
                                            if (tplRecipientFields.length === 0) return null;
                                            return (
                                              <div key={tpl.id}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{tpl.name}</p>
                                                <div className="space-y-2">
                                                  {tplRecipientFields.map(({ field, tpl: fieldTpl }) => {
                                                    const nsKey = `${fieldTpl.id}:${field.id}`;
                                                    const isDropdown = field.type === "dropdown" || field.fieldType === "dropdown";
                                                    const isCheckbox = field.type === "checkbox" || field.fieldType === "checkbox";

                                                    if (isDropdown) {
                                                      const opts = field.options && field.options.length > 0 ? field.options : [];
                                                      return (
                                                        <div key={nsKey}>
                                                          <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                                                            {field.label}
                                                            <Badge variant="secondary" className={`text-[9px] ${getFieldBadgeColor(field.type, field.fieldType)}`}>
                                                              {getFieldConfig(field.type).label}
                                                            </Badge>
                                                          </Label>
                                                          <Select
                                                            value={prefillValues[nsKey] || field.prefillValue || ""}
                                                            onValueChange={(val) => setPrefillValues((prev) => ({ ...prev, [nsKey]: val }))}
                                                          >
                                                            <SelectTrigger className="h-7 text-xs" data-testid={`select-multi-prefill-${nsKey}`}>
                                                              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              {opts.map((opt) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                              ))}
                                                            </SelectContent>
                                                          </Select>
                                                        </div>
                                                      );
                                                    }

                                                    if (isCheckbox) {
                                                      const isChecked = (prefillValues[nsKey] || field.prefillValue || "false") === "true";
                                                      return (
                                                        <div
                                                          key={nsKey}
                                                          className="flex items-center gap-2.5 py-1 cursor-pointer rounded hover:bg-muted/40 px-1 transition-colors"
                                                          onClick={() => setPrefillValues((prev) => ({ ...prev, [nsKey]: isChecked ? "false" : "true" }))}
                                                          data-testid={`checkbox-multi-prefill-${nsKey}`}
                                                        >
                                                          {isChecked ? (
                                                            <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                                          ) : (
                                                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                                          )}
                                                          <span className="text-xs font-medium">{field.label}</span>
                                                        </div>
                                                      );
                                                    }

                                                    return (
                                                    <div key={nsKey}>
                                                      <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                                                        {field.label}
                                                        <Badge variant="secondary" className={`text-[9px] ${getFieldBadgeColor(field.type, field.fieldType)}`}>
                                                          {getFieldConfig(field.type).label}
                                                        </Badge>
                                                      </Label>
                                                      <Input
                                                        className="h-7 text-xs"
                                                        value={prefillValues[nsKey] || field.prefillValue || ""}
                                                        onChange={(e) => setPrefillValues((prev) => ({ ...prev, [nsKey]: e.target.value }))}
                                                        placeholder={`${field.label}...`}
                                                        data-testid={`input-multi-prefill-${nsKey}`}
                                                      />
                                                    </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}

                      <div>
                        <Label htmlFor="title">Agreement Title</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Service Agreement, Terms & Conditions"
                          data-testid="input-agreement-title"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="recipientName">Recipient Name</Label>
                          <Input
                            id="recipientName"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="John Smith"
                            data-testid="input-recipient-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="recipientEmail">Recipient Email</Label>
                          <Input
                            id="recipientEmail"
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="john@example.com"
                            data-testid="input-recipient-email"
                          />
                        </div>
                      </div>
                      {!useTemplate && (
                        <div>
                          <Label htmlFor="content">Agreement Content</Label>
                          <Textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter the full text of your agreement here..."
                            rows={12}
                            data-testid="input-agreement-content"
                          />
                        </div>
                      )}
                    </div>
                  );

                  return hasPreview ? (
                    <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
                      <div className="flex-1 flex flex-col items-center min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPreviewPage(Math.max(1, previewPage - 1))}
                            disabled={previewPage <= 1}
                            data-testid="button-preview-prev"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground" data-testid="text-preview-page-info">
                            Page {previewPage} of {previewNumPages}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPreviewPage(Math.min(previewNumPages, previewPage + 1))}
                            disabled={previewPage >= previewNumPages}
                            data-testid="button-preview-next"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          {multiTemplateMode && selectedTemplates.length > 1 && (
                            <span className="text-[10px] text-muted-foreground ml-2">
                              Previewing: {previewTemplate!.name}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-h-0 flex justify-center items-start overflow-hidden" ref={previewContainerRef}>
                          <div className="relative border rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 inline-block" data-testid="pdf-preview-container">
                            <Document
                              file={`/api/agreement-pdf${previewTemplate!.pdfUrl.replace('/agreement-pdfs', '')}`}
                              onLoadSuccess={({ numPages }) => setPreviewNumPages(numPages)}
                              loading={
                                <div className="flex items-center justify-center py-20 px-32">
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                              }
                            >
                              <Page
                                pageNumber={previewPage}
                                width={previewContainerHeight > 0
                                  ? Math.min(Math.floor(previewContainerHeight / 1.294), window.innerWidth * 0.45)
                                  : Math.min(550, window.innerWidth * 0.45)}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            </Document>
                            {previewFields.map((field) => {
                              const prefillKey = multiTemplateMode ? `${previewTemplate!.id}:${field.id}` : field.id;
                              const liveValue = prefillValues[prefillKey] || field.prefillValue || "";
                              const isSignerOnly = field.type === "signature" || field.type === "initials";
                              const isCheckbox = field.type === "checkbox";
                              const displayValue = isSignerOnly ? "" : liveValue;

                              return (
                                <div
                                  key={field.id}
                                  className={`absolute border-2 rounded-sm flex items-center ${displayValue ? "justify-start" : "justify-center"} ${fieldTypeColors[field.type] || "border-gray-400 bg-gray-50/80"}`}
                                  style={{
                                    left: `${field.x}%`,
                                    top: `${field.y}%`,
                                    width: `${field.width}%`,
                                    height: `${field.height}%`,
                                  }}
                                  title={`${field.label} (${getFieldConfig(field.type).label})`}
                                  data-testid={`preview-field-${field.id}`}
                                >
                                  {isCheckbox ? (
                                    <span className="text-[10px] font-bold px-0.5">
                                      {liveValue ? "✓" : ""}
                                    </span>
                                  ) : displayValue ? (
                                    <span className="text-[10px] font-semibold truncate px-1 text-gray-900 dark:text-gray-100" data-testid={`preview-value-${field.id}`}>
                                      {displayValue}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-medium truncate px-0.5 opacity-50 italic">
                                      {field.label}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="w-[380px] flex-shrink-0 overflow-y-auto pr-1">
                        {formContent}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {formContent}
                    </div>
                  );
                })()}
                <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || createAndSendMutation.isPending || !canCreateAgreement}
                    variant="outline"
                    data-testid="button-submit-agreement"
                  >
                    {createMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      "Create Agreement"
                    )}
                  </Button>
                  <Button
                    onClick={() => createAndSendMutation.mutate()}
                    disabled={createAndSendMutation.isPending || createMutation.isPending || !canCreateAgreement}
                    data-testid="button-create-and-send-agreement"
                  >
                    {createAndSendMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Create & Send</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : agreements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSignature className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No agreements yet</h3>
                <p className="text-muted-foreground text-sm">
                  Use the {isAgent ? "Send Agreement" : "New Agreement"} button above to send your first agreement for signature.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Agreement</TableHead>
                      <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Recipient</TableHead>
                      <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</TableHead>
                      {!isAgent && <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sent By</TableHead>}
                      <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sent / Created</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgreements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAgent ? 5 : 6} className="py-10 text-center text-sm text-muted-foreground">
                          No agreements match your search.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {filteredAgreements.map((ag) => (
                      <TableRow key={ag.id} data-testid={`row-agreement-${ag.id}`} className={ag.status === "declined" ? "bg-red-50/30 dark:bg-red-950/10" : ag.status === "signed" ? "opacity-80" : ""}>
                        <TableCell className="pl-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-sm leading-snug">{ag.title}</span>
                            {ag.pdfUrl && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                                <FileUp className="h-3 w-3" />
                                PDF template
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium">{ag.recipientName}</div>
                            <div className="text-xs text-muted-foreground">{ag.recipientEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(ag.status)}</TableCell>
                        {!isAgent && (
                          <TableCell>
                            {ag.senderName ? (
                              <div>
                                <div className="text-sm">{ag.senderName}</div>
                                <Badge variant="outline" className="text-xs mt-0.5" data-testid={`badge-sender-type-${ag.id}`}>
                                  {ag.senderUserId && agentUserIds.has(ag.senderUserId) ? "Agent" : "Merchant"}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {ag.sentAt
                            ? new Date(ag.sentAt).toLocaleDateString()
                            : new Date(ag.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {isAgent ? (
                            <div className="flex items-center justify-end gap-1 pr-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => loadAuditTrail(ag)}
                                data-testid={`button-view-agreement-${ag.id}`}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                              {ag.status !== "signed" && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      data-testid={`button-more-agreement-${ag.id}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {(ag.status === "draft" || ag.status === "declined") && (
                                      <DropdownMenuItem
                                        onClick={() => sendMutation.mutate(ag.id)}
                                        data-testid={`menu-send-agreement-${ag.id}`}
                                      >
                                        <Send className="h-4 w-4 mr-2" />
                                        Send for signature
                                      </DropdownMenuItem>
                                    )}
                                    {(ag.status === "sent" || ag.status === "viewed") && (
                                      <DropdownMenuItem
                                        onClick={() => resendMutation.mutate(ag.id)}
                                        data-testid={`menu-resend-agreement-${ag.id}`}
                                      >
                                        <Mail className="h-4 w-4 mr-2" />
                                        Resend signing link
                                      </DropdownMenuItem>
                                    )}
                                    {ag.status !== "signed" && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setEditEmailAgreement(ag);
                                          setEditEmailValue(ag.recipientEmail);
                                        }}
                                        data-testid={`menu-edit-email-agreement-${ag.id}`}
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit recipient email
                                      </DropdownMenuItem>
                                    )}
                                    {ag.status !== "signed" && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => setDeleteId(ag.id)}
                                          data-testid={`menu-delete-agreement-${ag.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => loadAuditTrail(ag)}
                                data-testid={`button-view-agreement-${ag.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(ag.status === "draft" || ag.status === "declined") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => sendMutation.mutate(ag.id)}
                                  disabled={sendMutation.isPending}
                                  data-testid={`button-send-agreement-${ag.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {(ag.status === "sent" || ag.status === "viewed") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resendMutation.mutate(ag.id)}
                                  disabled={resendMutation.isPending}
                                  title="Resend signing email"
                                  data-testid={`button-resend-agreement-${ag.id}`}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              {ag.status !== "signed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditEmailAgreement(ag);
                                    setEditEmailValue(ag.recipientEmail);
                                  }}
                                  title="Edit recipient email"
                                  data-testid={`button-edit-email-${ag.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {ag.status !== "signed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteId(ag.id)}
                                  data-testid={`button-delete-agreement-${ag.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {!isAgent && <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={templateCreateOpen} onOpenChange={setTemplateCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Agreement Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input
                      id="templateName"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Merchant Service Agreement"
                      data-testid="input-template-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="templateDescription">Description (optional)</Label>
                    <Textarea
                      id="templateDescription"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of this template..."
                      rows={3}
                      data-testid="input-template-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="templatePdf">PDF File</Label>
                    <Input
                      id="templatePdf"
                      type="file"
                      accept=".pdf"
                      ref={fileInputRef}
                      onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                      data-testid="input-template-pdf"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="templateShared" className="text-sm">Share with Agent Portal</Label>
                    <Switch
                      id="templateShared"
                      checked={templateSharedWithAgents}
                      onCheckedChange={setTemplateSharedWithAgents}
                      data-testid="switch-template-shared"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTemplateCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createTemplateMutation.mutate()}
                    disabled={createTemplateMutation.isPending || !templateName.trim() || !templateFile}
                    data-testid="button-submit-template"
                  >
                    {createTemplateMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <>
                        <FileUp className="h-4 w-4 mr-2" />
                        Create Template
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {templatesLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Copy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Upload a PDF to create your first agreement template.
                </p>
                <Button onClick={() => setTemplateCreateOpen(true)} data-testid="button-create-first-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>PDF File</TableHead>
                      <TableHead>Fields</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tpl) => {
                      const rawTplFields = JSON.parse(tpl.signatureFields || "[]");
                      const fieldCount = (rawTplFields.length > 0 && rawTplFields[0]?.__sectionsMeta) ? rawTplFields.length - 1 : rawTplFields.length;
                      return (
                        <TableRow key={tpl.id} data-testid={`row-template-${tpl.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Copy className="h-4 w-4 text-muted-foreground" />
                              {tpl.name}
                              {tpl.sharedWithAgents === false ? (
                                <Badge variant="outline" className="text-xs ml-1">Private</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs ml-1">Shared</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {tpl.description || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <FileUp className="h-3 w-3" />
                              {tpl.pdfOriginalName || "document.pdf"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(tpl.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Rename / Edit Details"
                                onClick={() => {
                                  setEditDetailsTemplate(tpl);
                                  setEditDetailsName(tpl.name);
                                  setEditDetailsDescription(tpl.description || "");
                                  setEditDetailsShared(tpl.sharedWithAgents !== false);
                                }}
                                data-testid={`button-edit-details-${tpl.id}`}
                              >
                                <Pencil className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Clone Template"
                                onClick={() => cloneTemplateMutation.mutate(tpl.id)}
                                disabled={cloneTemplateMutation.isPending}
                                data-testid={`button-clone-template-${tpl.id}`}
                              >
                                {cloneTemplateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Replace PDF"
                                onClick={() => {
                                  setReplacePdfTemplateId(tpl.id);
                                  setTimeout(() => replacePdfInputRef.current?.click(), 0);
                                }}
                                disabled={replacePdfMutation.isPending && replacePdfTemplateId === tpl.id}
                                data-testid={`button-replace-pdf-${tpl.id}`}
                              >
                                {replacePdfMutation.isPending && replacePdfTemplateId === tpl.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit Fields"
                                onClick={() => setEditFieldsTemplate(tpl)}
                                data-testid={`button-edit-fields-${tpl.id}`}
                              >
                                <Layers className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete Template"
                                onClick={() => setDeleteTemplateId(tpl.id)}
                                data-testid={`button-delete-template-${tpl.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>}
      </Tabs>

      <input
        type="file"
        accept=".pdf"
        ref={replacePdfInputRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replacePdfTemplateId) {
            replacePdfMutation.mutate({ id: replacePdfTemplateId, file });
          }
          e.target.value = "";
        }}
        data-testid="input-replace-pdf"
      />

      <Dialog open={!!viewAgreement} onOpenChange={(open) => !open && setViewAgreement(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewAgreement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  {viewAgreement.title}
                  {viewAgreement.pdfUrl && (
                    <Badge variant="secondary">
                      <FileUp className="h-3 w-3 mr-1" />
                      PDF
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Recipient</p>
                    <p className="text-sm font-medium">{viewAgreement.recipientName}</p>
                    <p className="text-xs text-muted-foreground">{viewAgreement.recipientEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <div>{statusBadge(viewAgreement.status)}</div>
                  </div>
                  {viewAgreement.senderName && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Sent By</p>
                      <p className="text-sm">{viewAgreement.senderName}</p>
                      {viewAgreement.senderEmail && (
                        <p className="text-xs text-muted-foreground">{viewAgreement.senderEmail}</p>
                      )}
                    </div>
                  )}
                  {viewAgreement.signedAt && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Signed</p>
                      <p className="text-sm">{new Date(viewAgreement.signedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {!isAgent && (
                  <>
                    <Separator />

                    {viewAgreement.pdfUrl ? (
                      <div>
                        <h4 className="text-sm font-medium mb-2">PDF Agreement</h4>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPdfViewPage(1);
                            setPdfViewNumPages(1);
                            setPdfViewAgreement(viewAgreement);
                          }}
                          data-testid="button-view-pdf"
                        >
                          <FileUp className="h-4 w-4 mr-2" />
                          View PDF Document
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Agreement Content</h4>
                        <div className="bg-muted/50 rounded-md p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {viewAgreement.content}
                        </div>
                      </div>
                    )}

                    {viewAgreement.signatureData && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">Signature</h4>
                          <div className="border rounded-md p-4 bg-white">
                            {viewAgreement.signatureData.startsWith("typed:") ? (
                              <p className="text-2xl italic font-serif text-gray-800" data-testid="text-signature-display">
                                {viewAgreement.signatureData.replace("typed:", "")}
                              </p>
                            ) : (
                              <img
                                src={viewAgreement.signatureData}
                                alt="Signature"
                                className="max-h-24"
                                data-testid="img-signature-display"
                              />
                            )}
                          </div>
                          {viewAgreement.signerIp && (
                            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> IP: {viewAgreement.signerIp}
                              </span>
                              {viewAgreement.signerEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {viewAgreement.signerEmail}
                                </span>
                              )}
                              {viewAgreement.signedAt && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {new Date(viewAgreement.signedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {!isAgent && (() => {
                  let detailFields: SignatureField[] = [];
                  let detailSectionOrder: string[] = [];
                  try {
                    const rawFields = viewAgreement.signatureFields ? JSON.parse(viewAgreement.signatureFields) : [];
                    if (rawFields.length > 0 && rawFields[0]?.__sectionsMeta) {
                      detailSectionOrder = rawFields[0].sections || [];
                      detailFields = rawFields.slice(1);
                    } else {
                      detailFields = rawFields;
                    }
                  } catch { detailFields = []; }
                  const textFields = detailFields.filter((f: SignatureField) => f.type !== "signature" && f.type !== "initials" && f.type !== "checkbox" && f.type !== "dropdown");
                  const checkboxDetailFields = detailFields.filter((f: SignatureField) => f.type === "checkbox");
                  const dropdownDetailFields = detailFields.filter((f: SignatureField) => f.type === "dropdown");
                  if (textFields.length === 0 && checkboxDetailFields.length === 0 && dropdownDetailFields.length === 0) return null;

                  let fieldDataMap: Record<string, string> = {};
                  try { fieldDataMap = viewAgreement.completedFieldData ? JSON.parse(viewAgreement.completedFieldData) : {}; } catch { fieldDataMap = {}; }

                  const senderDetailFields = textFields.filter((f: SignatureField) => f.filledBy === "sender");
                  const recipientDetailFields = textFields.filter((f: SignatureField) => f.filledBy !== "sender");

                  const renderDetailField = (field: SignatureField) => {
                    if (field.type === "checkbox") {
                      const isChecked = (fieldDataMap[field.id] || field.prefillValue || "false") === "true";
                      return (
                        <div key={field.id} className={`rounded-md px-3 py-2 border flex items-center gap-2 ${isChecked ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900" : "bg-muted/50"}`}>
                          {isChecked ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                          <span className="text-sm font-medium">{field.label}</span>
                        </div>
                      );
                    }
                    if (field.type === "dropdown") {
                      const rawValue = fieldDataMap[field.id] || field.prefillValue || "";
                      const selectedValue = rawValue === "__none__" ? "" : rawValue;
                      return (
                        <div key={field.id} className={`rounded-md px-3 py-2 border ${selectedValue ? "bg-lime-50 border-lime-100 dark:bg-lime-950/30 dark:border-lime-900" : "bg-muted/50"}`}>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</p>
                          <p className="text-sm font-medium truncate">{selectedValue || "—"}</p>
                        </div>
                      );
                    }
                    const isSender = field.filledBy === "sender";
                    return (
                      <div key={field.id} className={isSender ? "bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2 border border-amber-100 dark:border-amber-900" : "bg-muted/50 rounded-md px-3 py-2 border"}>
                        <p className={`text-[10px] uppercase tracking-wider ${isSender ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{field.label}</p>
                        <p className="text-sm font-medium truncate">{fieldDataMap[field.id] || field.prefillValue || "—"}</p>
                      </div>
                    );
                  };

                  const sectionOrder = detailSectionOrder.length > 0 ? detailSectionOrder : (() => {
                    const derived: string[] = [];
                    detailFields.forEach((f: SignatureField) => { if (f.section && !derived.includes(f.section)) derived.push(f.section); });
                    return derived;
                  })();
                  const hasSections = sectionOrder.length > 0;

                  const allDisplayFields = [...textFields, ...checkboxDetailFields, ...dropdownDetailFields];

                  return (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-3">Completed Field Data</h4>
                        <div className="space-y-3">
                          {hasSections ? (
                            <>
                              {sectionOrder.map((sec) => {
                                const sectionFields = allDisplayFields.filter((f: SignatureField) => f.section === sec);
                                if (sectionFields.length === 0) return null;
                                return (
                                  <div key={sec}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="h-px flex-1 bg-border" />
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{sec}</span>
                                      <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {sectionFields.map(renderDetailField)}
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                const unsectioned = allDisplayFields.filter((f: SignatureField) => !f.section);
                                if (unsectioned.length === 0) return null;
                                return (
                                  <div>
                                    {unsectioned.length < allDisplayFields.length && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Other</span>
                                        <div className="h-px flex-1 bg-border" />
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                      {unsectioned.map(renderDetailField)}
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              {senderDetailFields.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Sender-filled
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {senderDetailFields.map(renderDetailField)}
                                  </div>
                                </div>
                              )}
                              {recipientDetailFields.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <User className="h-3 w-3" /> Recipient-filled
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {recipientDetailFields.map(renderDetailField)}
                                  </div>
                                </div>
                              )}
                              {checkboxDetailFields.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Selections</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {checkboxDetailFields.map(renderDetailField)}
                                  </div>
                                </div>
                              )}
                              {dropdownDetailFields.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Dropdown Selections</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {dropdownDetailFields.map(renderDetailField)}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Audit Trail
                  </h4>
                  {auditLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : auditTrail.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No audit trail entries yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {auditTrail.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border"
                          data-testid={`audit-entry-${entry.id}`}
                        >
                          <div className="mt-0.5">{actionIcon(entry.action)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-medium capitalize">{entry.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                            {entry.details && (
                              <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {entry.actorEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {entry.actorEmail}
                                </span>
                              )}
                              {entry.actorIp && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" /> {entry.actorIp}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agreement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agreement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteTemplateMutation.mutate(deleteTemplateId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-template"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editDetailsTemplate} onOpenChange={(open) => { if (!open) setEditDetailsTemplate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTemplateName">Template Name</Label>
              <Input
                id="editTemplateName"
                value={editDetailsName}
                onChange={(e) => setEditDetailsName(e.target.value)}
                placeholder="Template name"
                data-testid="input-edit-template-name"
              />
            </div>
            <div>
              <Label htmlFor="editTemplateDescription">Description (optional)</Label>
              <Textarea
                id="editTemplateDescription"
                value={editDetailsDescription}
                onChange={(e) => setEditDetailsDescription(e.target.value)}
                placeholder="Brief description of this template..."
                rows={3}
                data-testid="input-edit-template-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="editTemplateShared" className="text-sm">Share with Agent Portal</Label>
              <Switch
                id="editTemplateShared"
                checked={editDetailsShared}
                onCheckedChange={setEditDetailsShared}
                data-testid="switch-edit-template-shared"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDetailsTemplate(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editDetailsTemplate) return;
                updateDetailsMutation.mutate({
                  id: editDetailsTemplate.id,
                  name: editDetailsName.trim(),
                  description: editDetailsDescription.trim(),
                  sharedWithAgents: editDetailsShared,
                });
              }}
              disabled={updateDetailsMutation.isPending || !editDetailsName.trim()}
              data-testid="button-save-template-details"
            >
              {updateDetailsMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editFieldsTemplate} onOpenChange={(open) => !open && setEditFieldsTemplate(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {editFieldsTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  Edit Signature Fields — {editFieldsTemplate.name}
                </DialogTitle>
              </DialogHeader>
              <PdfFieldEditor
                pdfUrl={editFieldsTemplate.pdfUrl}
                signatureFields={(() => { try { return JSON.parse(editFieldsTemplate.signatureFields || "[]"); } catch { return []; } })()}
                onSave={(fields: SignatureField[]) => saveFields(editFieldsTemplate.id, fields)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEmailAgreement} onOpenChange={(open) => { if (!open) { setEditEmailAgreement(null); setEditEmailValue(""); } }}>
        <DialogContent>
          {editEmailAgreement && (
            <>
              <DialogHeader>
                <DialogTitle>Update Recipient Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Update the email address for <strong>{editEmailAgreement.recipientName}</strong> on "{editEmailAgreement.title}".
                </p>
                <div>
                  <Label htmlFor="editEmail">New Email Address</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editEmailValue}
                    onChange={(e) => setEditEmailValue(e.target.value)}
                    placeholder="corrected@email.com"
                    data-testid="input-edit-recipient-email"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditEmailAgreement(null); setEditEmailValue(""); }}>Cancel</Button>
                <Button
                  onClick={() => updateRecipientMutation.mutate({ id: editEmailAgreement.id, recipientEmail: editEmailValue })}
                  disabled={updateRecipientMutation.isPending || !editEmailValue.trim() || !editEmailValue.includes("@")}
                  data-testid="button-save-recipient-email"
                >
                  {updateRecipientMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    "Update Email"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdfViewAgreement} onOpenChange={(open) => { if (!open) setPdfViewAgreement(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {pdfViewAgreement && (() => {
            let pdfFields: SignatureField[] = [];
            try {
              const raw = pdfViewAgreement.signatureFields ? JSON.parse(pdfViewAgreement.signatureFields) : [];
              pdfFields = (raw.length > 0 && raw[0]?.__sectionsMeta) ? raw.slice(1) : raw;
            } catch { pdfFields = []; }

            let fieldData: Record<string, string> = {};
            try { fieldData = pdfViewAgreement.completedFieldData ? JSON.parse(pdfViewAgreement.completedFieldData) : {}; } catch { fieldData = {}; }

            const pageFields = pdfFields.filter((f) => f.page === pdfViewPage);

            const fieldTypeColors: Record<string, string> = {
              signature: "border-blue-500 bg-blue-50/90",
              initials: "border-violet-500 bg-violet-50/90",
              date: "border-cyan-500 bg-cyan-50/90",
              text: "border-emerald-500 bg-emerald-50/90",
              full_name: "border-emerald-500 bg-emerald-50/90",
              first_name: "border-emerald-500 bg-emerald-50/90",
              last_name: "border-emerald-500 bg-emerald-50/90",
              email: "border-teal-500 bg-teal-50/90",
              phone: "border-pink-500 bg-pink-50/90",
              business_name: "border-orange-500 bg-orange-50/90",
              title: "border-indigo-500 bg-indigo-50/90",
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    {pdfViewAgreement.title} — Completed Document
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPdfViewPage(Math.max(1, pdfViewPage - 1))}
                      disabled={pdfViewPage <= 1}
                      data-testid="button-pdfview-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground" data-testid="text-pdfview-page-info">
                      Page {pdfViewPage} of {pdfViewNumPages || "..."}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPdfViewPage(Math.min(pdfViewNumPages, pdfViewPage + 1))}
                      disabled={pdfViewPage >= pdfViewNumPages}
                      data-testid="button-pdfview-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-center">
                    <div className="relative border rounded-md overflow-hidden bg-gray-100 inline-block">
                      <Document
                        file={`/api/agreement-pdf${pdfViewAgreement.pdfUrl!.replace('/agreement-pdfs', '')}`}
                        onLoadSuccess={({ numPages }) => setPdfViewNumPages(numPages)}
                        loading={
                          <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        }
                      >
                        <Page
                          pageNumber={pdfViewPage}
                          width={Math.min(700, window.innerWidth - 120)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                      </Document>

                      {pageFields.map((field) => {
                        const isSender = field.filledBy === "sender";
                        const isCheckbox = field.type === "checkbox";
                        const isDropdown = field.type === "dropdown";
                        const isSignature = field.type === "signature" || field.type === "initials";
                        const value = fieldData[field.id] ?? field.prefillValue ?? "";

                        const senderActualValue = fieldData[field.id] || field.prefillValue;
                        if (isSender && !field.required && !senderActualValue) return null;

                        if (isCheckbox) {
                          const checked = value === "true";
                          return (
                            <div
                              key={field.id}
                              className={`absolute border-2 rounded flex items-center justify-center ${
                                checked ? "border-emerald-500 bg-emerald-50" : "border-gray-300 bg-white/80"
                              }`}
                              style={{
                                left: `${field.x}%`, top: `${field.y}%`,
                                width: `${field.width}%`, height: `${field.height}%`,
                                zIndex: 10,
                              }}
                            >
                              {checked ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                            </div>
                          );
                        }

                        if (isDropdown) {
                          const dropVal = value === "__none__" ? "" : value;
                          return (
                            <div
                              key={field.id}
                              className={`absolute border-2 rounded flex items-center overflow-hidden ${
                                dropVal ? "border-lime-500 bg-white/90" : "border-gray-300 bg-white/80"
                              }`}
                              style={{
                                left: `${field.x}%`, top: `${field.y}%`,
                                width: `${field.width}%`, height: `${field.height}%`,
                                zIndex: 10,
                              }}
                            >
                              <span className="w-full h-full flex items-center text-xs font-medium text-gray-900 px-1 truncate">
                                {dropVal || field.label}
                              </span>
                            </div>
                          );
                        }

                        if (isSignature) {
                          const sigValue = value || viewAgreement?.signatureData || "";
                          if (sigValue) {
                            return (
                              <div
                                key={field.id}
                                className="absolute border-2 border-blue-500 rounded bg-white/95 flex items-center justify-center overflow-hidden"
                                style={{
                                  left: `${field.x}%`, top: `${field.y}%`,
                                  width: `${field.width}%`, height: `${field.height}%`,
                                  zIndex: 10,
                                }}
                              >
                                {sigValue.startsWith("typed:") ? (
                                  <span className="text-sm italic font-serif text-gray-800 px-1 truncate">{sigValue.replace("typed:", "")}</span>
                                ) : sigValue.startsWith("data:") ? (
                                  <img src={sigValue} alt="Signature" className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-xs text-gray-500 px-1">{field.label}</span>
                                )}
                              </div>
                            );
                          }
                        }

                        return (
                          <div
                            key={field.id}
                            className={`absolute border-2 rounded flex items-center overflow-hidden ${
                              value
                                ? `border-solid bg-white/90 ${fieldTypeColors[field.type] || "border-gray-400 bg-gray-50/90"}`
                                : "border-gray-300 bg-white/80"
                            }`}
                            style={{
                              left: `${field.x}%`, top: `${field.y}%`,
                              width: `${field.width}%`, height: `${field.height}%`,
                              zIndex: 10,
                            }}
                          >
                            <span className="w-full h-full flex items-center text-xs font-medium text-gray-900 px-1 truncate">
                              {value || field.label}
                              {isSender && <Lock className="h-2.5 w-2.5 ml-auto text-gray-400 shrink-0" />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
