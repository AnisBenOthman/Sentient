import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Pencil,
  Trash2,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

import {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  extractApiError,
  DOCUMENT_CATEGORIES,
  DOCUMENT_ERROR_MESSAGES,
  type DocumentCategory,
  type DocumentResponse,
} from "@/lib/api/social";

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(cat: DocumentCategory): string {
  const map: Record<DocumentCategory, string> = {
    INTERNAL_POLICY: "Internal Policy",
    HANDBOOK: "Handbook",
    REGULATION: "Regulation",
    TEMPLATE: "Template",
    GUIDE: "Guide",
    OTHER: "Other",
  };
  return map[cat];
}

async function extractDocumentErrorCode(err: unknown): Promise<string> {
  const syncCode = extractApiError(err);
  if (syncCode) return syncCode;

  if (typeof err !== "object" || err === null || !("response" in err)) return "";
  const response = (err as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!(data instanceof Blob)) return "";

  try {
    const parsed = JSON.parse(await data.text()) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Upload / Edit modal
// ---------------------------------------------------------------------------
interface DocumentFormProps {
  open: boolean;
  onClose: () => void;
  existing?: DocumentResponse;
  onSuccess: () => void;
}

function DocumentFormModal({
  open,
  onClose,
  existing,
  onSuccess,
}: DocumentFormProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(
    existing?.description ?? ""
  );
  const [category, setCategory] = useState<DocumentCategory>(
    existing?.category ?? "OTHER"
  );
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? true);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!existing;

  const mutation = useMutation({
    mutationFn: (fd: FormData) =>
      isEdit ? updateDocument(existing!.id, fd) : createDocument(fd),
    onSuccess: () => {
      onSuccess();
      onClose();
      toast({
        title: isEdit ? "Document updated" : "Document uploaded",
      });
    },
    onError: (err: unknown) => {
      const code = extractApiError(err);
      const msg =
        DOCUMENT_ERROR_MESSAGES[code] ??
        "Failed to complete the action. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("category", category);
    fd.append("isPublic", String(isPublic));
    const file = fileRef.current?.files?.[0];
    if (file) fd.append("file", file);
    if (!isEdit && !file) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(fd);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit document" : "Upload document"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={1}
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label>Category *</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="isPublic">Visible to all employees</Label>
          </div>
          <div className="space-y-1">
            <Label>{isEdit ? "Replace file (optional)" : "File *"}</Label>
            <Input type="file" ref={fileRef} accept=".pdf,.docx,.txt,.md,.html" />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving…"
                : isEdit
                ? "Save changes"
                : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // HR_ADMIN check is explicit — getRoleTier() returns 'hr_admin' for EXECUTIVE too,
  // which would incorrectly show Upload/Edit/Delete buttons to non-admin users.
  const isAdmin = user?.roles?.includes("HR_ADMIN") ?? false;

  const PAGE_SIZE = 20;

  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    DocumentCategory | null
  >(null);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(searchInput, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategory, debouncedSearch]);

  const queryKey = [
    "documents",
    { page, pageSize: PAGE_SIZE, category: activeCategory, search: debouncedSearch },
  ] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listDocuments({
        page,
        pageSize: PAGE_SIZE,
        category: activeCategory ?? undefined,
        search: debouncedSearch || undefined,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentResponse | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentResponse | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDeleteDoc(null);
      toast({ title: "Document deleted" });
    },
    onError: (err: unknown) => {
      const code = extractApiError(err);
      const msg =
        DOCUMENT_ERROR_MESSAGES[code] ??
        "Failed to delete document. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  function handleDownload(doc: DocumentResponse) {
    downloadDocument(doc.id, doc.title, doc.mimeType).catch(async (err: unknown) => {
      const code = await extractDocumentErrorCode(err);
      const msg =
        DOCUMENT_ERROR_MESSAGES[code] ??
        "Failed to complete the action. Please try again.";
      toast({
        title: "Download failed",
        description: msg,
        variant: "destructive",
      });
    });
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Documents</h1>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title…"
          className="pl-9"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setSearchInput("")}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setActiveCategory(null)}
        >
          All
        </Badge>
        {DOCUMENT_CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() =>
              setActiveCategory((prev) => (prev === cat ? null : cat))
            }
          >
            {categoryLabel(cat)}
          </Badge>
        ))}
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-16">Loading…</div>
      ) : !data?.items.length ? (
        <div className="text-center py-16 text-muted-foreground space-y-4">
          <FileText className="mx-auto h-12 w-12 opacity-30" />
          <p className="text-lg">No documents yet</p>
          {isAdmin && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload your first document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((doc) => (
            <Card key={doc.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {doc.title}
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {categoryLabel(doc.category)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grow space-y-1 text-sm text-muted-foreground">
                {doc.description && (
                  <p className="line-clamp-2">{doc.description}</p>
                )}
                <p>
                  {doc.uploadedBy
                    ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`
                    : "Unknown"}
                </p>
                <p>
                  {new Date(doc.createdAt).toLocaleDateString()} ·{" "}
                  {formatBytes(doc.sizeBytes)} · v{doc.version}
                </p>
              </CardContent>
              <CardFooter className="gap-2 pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditDoc(doc)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDoc(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <DocumentFormModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["documents"] })
          }
        />
      )}

      {/* Edit modal */}
      {editDoc && (
        <DocumentFormModal
          open={!!editDoc}
          onClose={() => setEditDoc(null)}
          existing={editDoc}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["documents"] })
          }
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteDoc}
        onOpenChange={(open) => !open && setDeleteDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.title}" will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteDoc && deleteMutation.mutate(deleteDoc.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
