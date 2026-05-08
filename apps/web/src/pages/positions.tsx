import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPositions,
  createPosition,
  updatePosition,
  deactivatePosition,
  type Position,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Search, Briefcase, Plus, Pencil, Trash2, ShieldAlert, Key } from "lucide-react";
import { cn } from "@/lib/utils";

const POSITION_LEVELS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MEDIUM", label: "Medium" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SENIOR_1", label: "Senior I" },
  { value: "SENIOR_2", label: "Senior II" },
  { value: "EXPERT", label: "Expert" },
];

const LEVEL_COLORS: Record<string, string> = {
  JUNIOR: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SENIOR_1: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SENIOR_2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  EXPERT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── Position Form ─────────────────────────────────────────────────────────────
type PosForm = {
  title: string;
  level: string;
  isKeyPosition: boolean;
  hasSuccessor: boolean;
};

function emptyForm(): PosForm {
  return { title: "", level: "", isKeyPosition: false, hasSuccessor: false };
}

function formFromPosition(p: Position): PosForm {
  return {
    title: p.title,
    level: p.level ?? "",
    isKeyPosition: p.isKeyPosition,
    hasSuccessor: p.hasSuccessor,
  };
}

function PositionDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: PosForm) => void;
  initial: PosForm;
  saving?: boolean;
}) {
  const [form, setForm] = useState<PosForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    onSave({ ...form, title: form.title.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos-title">Title</Label>
            <Input
              id="pos-title"
              value={form.title}
              onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setError(""); }}
              placeholder="e.g. Software Engineer"
              data-testid="input-pos-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-level">Level</Label>
            <Select
              value={form.level}
              onValueChange={(v) => setForm((p) => ({ ...p, level: v }))}
            >
              <SelectTrigger id="pos-level" data-testid="select-pos-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {POSITION_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Key position</p>
              <p className="text-xs text-muted-foreground">Critical to business continuity</p>
            </div>
            <Switch
              checked={form.isKeyPosition}
              onCheckedChange={(v) => setForm((p) => ({ ...p, isKeyPosition: v }))}
              data-testid="switch-pos-key"
            />
          </div>

          {form.isKeyPosition && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Successor identified</p>
                <p className="text-xs text-muted-foreground">A designated successor has been named</p>
              </div>
              <Switch
                checked={form.hasSuccessor}
                onCheckedChange={(v) => setForm((p) => ({ ...p, hasSuccessor: v }))}
                data-testid="switch-pos-successor"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500" data-testid="pos-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-pos">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Positions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Position | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  const isAdmin = user?.roles.includes("HR_ADMIN") ?? false;

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
  });

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updatePosition>[1] }) =>
      updatePosition(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deactivatePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDeleteTarget(null);
    },
  });

  const filtered = positions.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const initForm = editTarget ? formFromPosition(editTarget) : emptyForm();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(p: Position) { setEditTarget(p); setDialogOpen(true); }

  function handleSave(f: PosForm) {
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: {
          title: f.title,
          level: f.level || undefined,
          isKeyPosition: f.isKeyPosition,
          hasSuccessor: f.hasSuccessor,
        },
      });
    } else {
      createMutation.mutate({
        title: f.title,
        level: f.level || undefined,
        isKeyPosition: f.isKeyPosition,
        hasSuccessor: f.hasSuccessor,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-positions"
          >
            Positions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage job positions and their seniority levels
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2" data-testid="button-add-position">
            <Plus className="w-4 h-4" />
            Add Position
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search positions…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-positions"
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", value: positions.length },
          { label: "Key positions", value: positions.filter((p) => p.isKeyPosition).length },
          { label: "No successor", value: positions.filter((p) => p.isKeyPosition && !p.hasSuccessor).length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Flags</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((pos) => (
                  <TableRow key={pos.id} data-testid={`row-pos-${pos.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm">{pos.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pos.level ? (
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            LEVEL_COLORS[pos.level] ?? "bg-gray-100 text-gray-600",
                          )}
                        >
                          {POSITION_LEVELS.find((l) => l.value === pos.level)?.label ?? pos.level}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {pos.isKeyPosition && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs gap-1",
                              pos.keyPositionRisk
                                ? RISK_COLORS[pos.keyPositionRisk]
                                : "bg-amber-100 text-amber-700 border-amber-200",
                            )}
                          >
                            <Key className="w-3 h-3" />
                            Key
                            {pos.keyPositionRisk && ` · ${pos.keyPositionRisk.charAt(0)}${pos.keyPositionRisk.slice(1).toLowerCase()} risk`}
                          </Badge>
                        )}
                        {pos.isKeyPosition && !pos.hasSuccessor && (
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 bg-red-50 text-red-600 border-red-200"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            No successor
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(pos)}
                            data-testid={`button-edit-pos-${pos.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeleteTarget(pos)}
                            data-testid={`button-delete-pos-${pos.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-center text-sm text-muted-foreground py-8">
                      {search ? "No positions match your search." : "No positions configured."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PositionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={initForm}
        saving={isSaving}
        key={editTarget?.id ?? "new"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This position will be marked inactive. Employees currently assigned to this
              position will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-pos"
            >
              {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
