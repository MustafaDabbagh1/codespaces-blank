import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agreement, AgreementAuditEntry } from "@shared/schema";
import type { SignatureField } from "@/components/pdf-field-editor";
import {
  FileSignature,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Lock,
  XCircle,
  Calendar,
  User,
  Mail,
  Download,
  Search,
  MoreHorizontal,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function actionIcon(action: string) {
  switch (action) {
    case "created": return <FileSignature className="h-4 w-4 text-blue-500" />;
    case "sent":    return <Send className="h-4 w-4 text-blue-500" />;
    case "viewed":  return <Eye className="h-4 w-4 text-amber-500" />;
    case "signed":  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "declined":return <XCircle className="h-4 w-4 text-red-500" />;
    default:        return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

const fieldTypeColors: Record<string, string> = {
  signature:     "border-blue-500 bg-blue-50/90",
  initials:      "border-violet-500 bg-violet-50/90",
  date:          "border-cyan-500 bg-cyan-50/90",
  text:          "border-emerald-500 bg-emerald-50/90",
  full_name:     "border-emerald-500 bg-emerald-50/90",
  first_name:    "border-emerald-500 bg-emerald-50/90",
  last_name:     "border-emerald-500 bg-emerald-50/90",
  email:         "border-teal-500 bg-teal-50/90",
  phone:         "border-pink-500 bg-pink-50/90",
  business_name: "border-orange-500 bg-orange-50/90",
  title:         "border-indigo-500 bg-indigo-50/90",
};

const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SignedAgreementsPage() {
  const { toast } = useToast();
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [auditTrail, setAuditTrail] = useState<AgreementAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState(1);

  const [search, setSearch] = useState("");
  const [workFilter, setWorkFilter] = useState<string>("all");

  const { data: allAgreements = [], isLoading } = useQuery<Agreement[]>({
    queryKey: ["/api/agreements"],
  });

  const signedAgreements = useMemo(
    () => allAgreements.filter((a) => a.status === "signed"),
    [allAgreements]
  );

  const filtered = useMemo(() => {
    let list = workFilter === "all"
      ? signedAgreements
      : signedAgreements.filter((a) => (a.workStatus || "received") === workFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.recipientName || "").toLowerCase().includes(q) ||
          (a.recipientEmail || "").toLowerCase().includes(q) ||
          (a.senderName || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [signedAgreements, workFilter, search]);

  const receivedCount = useMemo(() => signedAgreements.filter((a) => (a.workStatus || "received") === "received").length, [signedAgreements]);
  const doneCount     = useMemo(() => signedAgreements.filter((a) => a.workStatus === "done").length, [signedAgreements]);

  const updateWorkStatusMutation = useMutation({
    mutationFn: async ({ id, workStatus }: { id: string; workStatus: string }) => {
      await apiRequest("PATCH", `/api/agreements/${id}/work-status`, { workStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const loadAuditTrail = async (agreementId: string) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/audit-trail`, { credentials: "include" });
      if (res.ok) setAuditTrail(await res.json());
    } catch { /* ignore */ }
    setAuditLoading(false);
  };

  const openAgreement = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setPdfPage(1);
    setPdfNumPages(1);
    setAuditTrail([]);
    loadAuditTrail(agreement.id);
  };

  const downloadPdf = async (agreement: Agreement) => {
    try {
      const response = await fetch(`/api/agreements/${agreement.id}/download-pdf`);
      if (!response.ok) throw new Error("Failed to download PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${agreement.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_signed.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(link); }, 1000);
    } catch (err) {
      console.error("PDF download error:", err);
    }
  };

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-signed-agreements-title">
          Signed Agreements
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track and manage completed contracts and signed documents
        </p>
      </div>

      {/* Metrics strip */}
      {!isLoading && signedAgreements.length > 0 && (
        <div className="flex items-center gap-5 text-sm flex-wrap" data-testid="metrics-strip">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tabular-nums" data-testid="text-total-signed">{signedAgreements.length}</span>
            <span className="text-muted-foreground">{signedAgreements.length === 1 ? "agreement" : "agreements"}</span>
          </div>
          {receivedCount > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tabular-nums text-amber-600">{receivedCount}</span>
                <span className="text-muted-foreground">received</span>
              </div>
            </>
          )}
          {doneCount > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tabular-nums text-emerald-600">{doneCount}</span>
                <span className="text-muted-foreground">done</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-agreement-count">
          {isLoading
            ? "Loading..."
            : `${filtered.length} ${filtered.length === 1 ? "agreement" : "agreements"}`}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search agreements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-sm"
              data-testid="input-search-agreements"
            />
          </div>
          <Select value={workFilter} onValueChange={setWorkFilter}>
            <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-work-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All work states</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center space-y-3">
            <FileSignature className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium" data-testid="text-no-signed-agreements">
              {signedAgreements.length === 0 ? "No signed agreements yet" : "No agreements match your search"}
            </p>
            <p className="text-sm text-muted-foreground">
              {signedAgreements.length === 0
                ? "Signed agreements will appear here once recipients complete them."
                : "Try adjusting your search or filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table data-testid="table-signed-agreements">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Agreement</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Signer</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Work Status</TableHead>
                  <TableHead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Signed</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((agreement) => {
                  const ws = agreement.workStatus || "received";
                  return (
                    <TableRow
                      key={agreement.id}
                      className="cursor-pointer"
                      onClick={() => openAgreement(agreement)}
                      data-testid={`row-signed-agreement-${agreement.id}`}
                    >

                      {/* Agreement title + created date */}
                      <TableCell className="pl-5 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm" data-testid={`text-agreement-title-${agreement.id}`}>
                            {agreement.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60">
                            Created {formatDate(agreement.createdAt)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Signer: name + email */}
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm" data-testid={`text-signer-name-${agreement.id}`}>
                            {agreement.recipientName || "—"}
                          </span>
                          {agreement.recipientEmail && (
                            <span className="text-[11px] text-muted-foreground/70">
                              {agreement.recipientEmail}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Work status — inline select, stop click propagation */}
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={ws}
                          onValueChange={(value) =>
                            updateWorkStatusMutation.mutate({ id: agreement.id, workStatus: value })
                          }
                        >
                          <SelectTrigger
                            className={`h-7 w-28 text-xs font-normal ${
                              ws === "done"
                                ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                                : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                            }`}
                            data-testid={`select-work-status-${agreement.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="received">Received</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Signed date */}
                      <TableCell className="py-3 text-sm text-muted-foreground" data-testid={`text-signed-date-${agreement.id}`}>
                        {formatDate(agreement.signedAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              data-testid={`button-agreement-actions-${agreement.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => openAgreement(agreement)}
                              data-testid={`button-view-agreement-${agreement.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {agreement.pdfUrl && (
                              <DropdownMenuItem
                                onClick={() => downloadPdf(agreement)}
                                data-testid={`button-download-pdf-${agreement.id}`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Agreement Detail Dialog ── */}
      <Dialog open={!!selectedAgreement} onOpenChange={(open) => { if (!open) setSelectedAgreement(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedAgreement && (() => {
            let pdfFields: SignatureField[] = [];
            try {
              const raw = selectedAgreement.signatureFields ? JSON.parse(selectedAgreement.signatureFields) : [];
              pdfFields = (raw.length > 0 && raw[0]?.__sectionsMeta) ? raw.slice(1) : raw;
            } catch { pdfFields = []; }

            let fieldData: Record<string, string> = {};
            try { fieldData = selectedAgreement.completedFieldData ? JSON.parse(selectedAgreement.completedFieldData) : {}; } catch { fieldData = {}; }

            const hasPdf = !!selectedAgreement.pdfUrl;
            const totalPages = hasPdf ? pdfNumPages + 1 : 2;
            const isAuditPage = hasPdf ? pdfPage > pdfNumPages : pdfPage > 1;
            const pageFields = isAuditPage ? [] : pdfFields.filter((f) => f.page === pdfPage);
            const ws = selectedAgreement.workStatus || "received";
            const pdfWidth = Math.min(650, window.innerWidth - 120);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 shrink-0" />
                    {selectedAgreement.title}
                  </DialogTitle>
                  <DialogDescription>
                    Signed by {selectedAgreement.recipientName}
                    {selectedAgreement.signedAt ? ` on ${formatDate(selectedAgreement.signedAt)}` : ""}
                  </DialogDescription>
                </DialogHeader>

                {/* Sub-header: metadata + actions */}
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      {selectedAgreement.recipientName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {selectedAgreement.recipientEmail}
                    </span>
                    {selectedAgreement.signedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(selectedAgreement.signedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {selectedAgreement.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPdf(selectedAgreement)}
                        data-testid="button-download-signed-pdf"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Download PDF
                      </Button>
                    )}
                    <Select
                      value={ws}
                      onValueChange={(value) => {
                        updateWorkStatusMutation.mutate({ id: selectedAgreement.id, workStatus: value });
                        setSelectedAgreement({ ...selectedAgreement, workStatus: value });
                      }}
                    >
                      <SelectTrigger
                        className={`w-[130px] ${ws === "done"
                          ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                          : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"}`}
                        data-testid="select-work-status-detail"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* PDF page navigation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                      disabled={pdfPage <= 1}
                      data-testid="button-signed-pdf-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {pdfPage} of {totalPages}{isAuditPage ? " (Audit Trail)" : ""}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPdfPage(Math.min(totalPages, pdfPage + 1))}
                      disabled={pdfPage >= totalPages}
                      data-testid="button-signed-pdf-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex justify-center">
                    {isAuditPage ? (
                      // ── Audit Trail page ──────────────────────────────────
                      <div
                        className="border rounded-md bg-white dark:bg-gray-950 shadow-sm"
                        style={{ width: pdfWidth, minHeight: pdfWidth * 1.414 }}
                      >
                        <div className="p-8 space-y-6">
                          <div className="text-center border-b pb-4">
                            <h2 className="text-xl font-bold">Audit Trail</h2>
                            <p className="text-sm text-muted-foreground mt-1">{selectedAgreement.title}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recipient</p>
                              <p className="font-medium">{selectedAgreement.recipientName}</p>
                              <p className="text-muted-foreground text-xs">{selectedAgreement.recipientEmail}</p>
                            </div>
                            {selectedAgreement.senderName && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sent By</p>
                                <p className="font-medium">{selectedAgreement.senderName}</p>
                                {selectedAgreement.senderEmail && (
                                  <p className="text-muted-foreground text-xs">{selectedAgreement.senderEmail}</p>
                                )}
                              </div>
                            )}
                            {selectedAgreement.signedAt && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed</p>
                                <p className="font-medium">{new Date(selectedAgreement.signedAt).toLocaleString()}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 font-normal text-[11px]">
                                Signed
                              </Badge>
                            </div>
                          </div>

                          {selectedAgreement.signatureData && (
                            <div className="border-b pb-4">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Signature</p>
                              <div className="border rounded p-3 bg-gray-50 dark:bg-gray-900 inline-block">
                                {selectedAgreement.signatureData.startsWith("typed:") ? (
                                  <p className="text-xl italic font-serif text-gray-800 dark:text-gray-200">
                                    {selectedAgreement.signatureData.replace("typed:", "")}
                                  </p>
                                ) : (
                                  <img src={selectedAgreement.signatureData} alt="Signature" className="max-h-16" />
                                )}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Activity Log</p>
                            {auditLoading ? (
                              <div className="space-y-2">
                                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                              </div>
                            ) : auditTrail.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No audit entries found.</p>
                            ) : (
                              <div className="space-y-0">
                                {auditTrail.map((entry, idx) => (
                                  <div
                                    key={entry.id}
                                    className={`flex gap-3 py-2.5 text-sm ${idx < auditTrail.length - 1 ? "border-b border-dashed" : ""}`}
                                  >
                                    <div className="shrink-0 mt-0.5">{actionIcon(entry.action)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium capitalize">{entry.action}</div>
                                      {entry.actorName && (
                                        <div className="text-xs text-muted-foreground">
                                          by {entry.actorName}{entry.actorEmail ? ` (${entry.actorEmail})` : ""}
                                        </div>
                                      )}
                                      {entry.details && (
                                        <div className="text-xs text-muted-foreground">{entry.details}</div>
                                      )}
                                      {entry.actorIp && (
                                        <div className="text-xs text-muted-foreground">IP: {entry.actorIp}</div>
                                      )}
                                    </div>
                                    <div className="shrink-0 text-xs text-muted-foreground text-right">
                                      {new Date(entry.timestamp).toLocaleDateString()}<br />
                                      {new Date(entry.timestamp).toLocaleTimeString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="border-t pt-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                              <Shield className="h-3.5 w-3.5" />
                              This audit trail is securely maintained and tamper-proof
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // ── PDF viewer page ───────────────────────────────────
                      <div className="relative border rounded-md overflow-hidden bg-gray-100 inline-block">
                        {selectedAgreement.pdfUrl ? (
                          <>
                            <Document
                              file={`/api/agreement-pdf${selectedAgreement.pdfUrl!.replace('/agreement-pdfs', '')}`}
                              onLoadSuccess={({ numPages }) => setPdfNumPages(numPages)}
                              loading={
                                <div className="flex items-center justify-center py-20">
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                              }
                            >
                              <Page
                                pageNumber={pdfPage}
                                width={pdfWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            </Document>

                            {pageFields.map((field) => {
                              const isSender   = field.filledBy === "sender";
                              const isCheckbox = field.type === "checkbox";
                              const isDropdown = field.type === "dropdown";
                              const isSignature= field.type === "signature" || field.type === "initials";
                              const value = fieldData[field.id] ?? field.prefillValue ?? "";

                              const senderActualValue = fieldData[field.id] || field.prefillValue;
                              if (isSender && !field.required && !senderActualValue) return null;

                              if (isCheckbox) {
                                const checked = value === "true";
                                return (
                                  <div
                                    key={field.id}
                                    className={`absolute border-2 rounded flex items-center justify-center ${checked ? "border-emerald-500 bg-emerald-50" : "border-gray-300 bg-white/80"}`}
                                    style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%`, zIndex: 10 }}
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
                                    className={`absolute border-2 rounded flex items-center overflow-hidden ${dropVal ? "border-lime-500 bg-white/90" : "border-gray-300 bg-white/80"}`}
                                    style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%`, zIndex: 10 }}
                                  >
                                    <span className="w-full h-full flex items-center text-xs font-medium text-gray-900 px-1 truncate">
                                      {dropVal || field.label}
                                    </span>
                                  </div>
                                );
                              }

                              if (isSignature) {
                                const sigValue = value || selectedAgreement.signatureData || "";
                                if (sigValue) {
                                  return (
                                    <div
                                      key={field.id}
                                      className="absolute border-2 border-blue-500 rounded bg-white/95 flex items-center justify-center overflow-hidden"
                                      style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%`, zIndex: 10 }}
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
                                  className={`absolute border-2 rounded flex items-center overflow-hidden ${value ? `border-solid bg-white/90 ${fieldTypeColors[field.type] || "border-gray-400 bg-gray-50/90"}` : "border-gray-300 bg-white/80"}`}
                                  style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%`, zIndex: 10 }}
                                >
                                  <span className="w-full h-full flex items-center text-xs font-medium text-gray-900 px-1 truncate">
                                    {value || field.label}
                                    {isSender && <Lock className="h-2.5 w-2.5 ml-auto text-gray-400 shrink-0" />}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="bg-white dark:bg-gray-950 p-6" style={{ width: pdfWidth, minHeight: 400 }}>
                            <div className="text-sm whitespace-pre-wrap">
                              {selectedAgreement.content}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
