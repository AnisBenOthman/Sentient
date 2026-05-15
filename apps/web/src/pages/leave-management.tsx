import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  reactivateLeaveType,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getBusinessUnits,
  type LeaveType,
  type Holiday,
  type BusinessUnit,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  ShieldCheck,
  ListChecks,
  RefreshCw,
  Calendar,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HR_ROLES = ["HR_ADMIN", "EXECUTIVE"];

type Tab = "leave-types" | "holidays";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "leave-types", label: "Leave Types", icon: ListChecks },
  { id: "holidays", label: "Public Holidays", icon: Calendar },
];

// ── Leave Type Dialog ─────────────────────────────────────────────────────────
type LTForm = {
  name: string;
  requiresApproval: boolean;
  defaultDaysPerYear: string;
  color: string;
};

function emptyLTForm(): LTForm {
  return { name: "", requiresApproval: true, defaultDaysPerYear: "10", color: "#6366f1" };
}

function ltFormFromType(t: LeaveType): LTForm {
  return {
    name: t.name,
    requiresApproval: t.requiresApproval,
    defaultDaysPerYear: String(t.defaultDaysPerYear),
    color: t.color ?? "#6366f1",
  };
}

function LeaveTypeDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: LTForm) => void;
  initial: LTForm;
  saving?: boolean;
}) {
  const [form, setForm] = useState<LTForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    const days = Number(form.defaultDaysPerYear);
    if (isNaN(days) || days < 0) { setError("Days must be 0 or more (0 = unlimited)."); return; }
    onSave({ ...form, name: form.name.trim(), defaultDaysPerYear: String(Math.round(days)) });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.name ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lt-name">Name</Label>
            <Input
              id="lt-name"
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(""); }}
              placeholder="e.g. Bereavement"
              data-testid="input-lt-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lt-max-days">Days per year</Label>
              <Input
                id="lt-max-days"
                type="number"
                min={0}
                value={form.defaultDaysPerYear}
                onChange={(e) => { setForm((p) => ({ ...p, defaultDaysPerYear: e.target.value })); setError(""); }}
                placeholder="0 = unlimited"
                data-testid="input-lt-max-days"
              />
              <p className="text-xs text-muted-foreground">0 = unlimited</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lt-color">Colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="lt-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-input p-1"
                  data-testid="input-lt-color"
                />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Requires approval</p>
              <p className="text-xs text-muted-foreground">Manager must approve requests for this type</p>
            </div>
            <Switch
              checked={form.requiresApproval}
              onCheckedChange={(v) => setForm((p) => ({ ...p, requiresApproval: v }))}
              data-testid="switch-lt-requires-approval"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500" data-testid="lt-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-lt">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Holiday Dialog ────────────────────────────────────────────────────────────
type HolForm = {
  name: string;
  date: string;
  isRecurring: boolean;
};

function emptyHolForm(): HolForm {
  return { name: "", date: "", isRecurring: true };
}

function holFormFromHoliday(h: Holiday): HolForm {
  return { name: h.name, date: h.date, isRecurring: h.isRecurring };
}

function HolidayDialog({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: HolForm) => void;
  initial: HolForm;
  saving?: boolean;
}) {
  const [form, setForm] = useState<HolForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.name.trim()) { setError("Holiday name is required."); return; }
    if (!form.date) { setError("Date is required."); return; }
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.name ? "Edit Holiday" : "Add Public Holiday"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="hol-name">Holiday name</Label>
            <Input
              id="hol-name"
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(""); }}
              placeholder="e.g. Company Foundation Day"
              data-testid="input-hol-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hol-date">Date</Label>
            <Input
              id="hol-date"
              type="date"
              value={form.date}
              onChange={(e) => { setForm((p) => ({ ...p, date: e.target.value })); setError(""); }}
              data-testid="input-hol-date"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Recurring annually</p>
              <p className="text-xs text-muted-foreground">Repeat this holiday every year on the same date</p>
            </div>
            <Switch
              checked={form.isRecurring}
              onCheckedChange={(v) => setForm((p) => ({ ...p, isRecurring: v }))}
              data-testid="switch-hol-recurring"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500" data-testid="hol-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-hol">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Leave Types Panel ─────────────────────────────────────────────────────────
function LeaveTypesPanel({ businessUnitId }: { businessUnitId: string | null }) {
  const queryClient = useQueryClient();
  const { data: types = [], isLoading } = useQuery({
    queryKey: ["leave-types", businessUnitId, "all"],
    queryFn: () =>
      getLeaveTypes(
        businessUnitId
          ? { businessUnitId, includeInactive: true }
          : { includeInactive: true },
      ),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [reactivateTarget, setReactivateTarget] = useState<LeaveType | null>(null);

  const activeCount = types.filter((t) => t.isActive).length;

  const createMutation = useMutation({
    mutationFn: createLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateLeaveType>[1] }) =>
      updateLeaveType(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setDeleteTarget(null);
      setDeleteError("");
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : "Failed to deactivate leave type.";
      setDeleteError(
        msg === "LeaveTypeHasPendingRequests"
          ? "Cannot deactivate: there are pending leave requests for this type. Resolve them first."
          : msg,
      );
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateLeaveType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      setReactivateTarget(null);
    },
  });

  const initForm = editTarget ? ltFormFromType(editTarget) : emptyLTForm();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(t: LeaveType) { setEditTarget(t); setDialogOpen(true); }

  function handleSave(f: LTForm) {
    const days = Number(f.defaultDaysPerYear);
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: { name: f.name, requiresApproval: f.requiresApproval, defaultDaysPerYear: days, color: f.color },
      });
    } else {
      if (!businessUnitId) return;
      createMutation.mutate({
        businessUnitId,
        name: f.name,
        requiresApproval: f.requiresApproval,
        defaultDaysPerYear: days,
        maxCarryoverDays: 0,
        color: f.color,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {activeCount} active type{activeCount !== 1 ? "s" : ""}
            {types.length > activeCount && (
              <span className="text-muted-foreground font-normal">
                {" "}· {types.length - activeCount} inactive
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {businessUnitId
              ? "Active types appear in the leave request form for employees"
              : "Select a business unit above to add or edit leave types"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={openAdd}
          disabled={!businessUnitId}
          data-testid="button-add-lt"
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Type
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Requires Approval</TableHead>
                  <TableHead>Days / year</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow
                    key={t.id}
                    data-testid={`row-lt-${t.id}`}
                    className={cn(!t.isActive && "opacity-50")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.color && (
                          <span
                            className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                        )}
                        <span className={cn("font-medium text-sm", !t.isActive && "line-through text-muted-foreground")}>
                          {t.name}
                        </span>
                        {!t.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-normal no-underline">
                            Inactive
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          t.requiresApproval
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        )}
                      >
                        {t.requiresApproval ? "Yes" : "No"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.defaultDaysPerYear === 0 ? (
                        <span className="text-muted-foreground">Unlimited</span>
                      ) : (
                        `${t.defaultDaysPerYear} days`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {t.isActive ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(t)}
                              aria-label={`Edit ${t.name}`}
                              data-testid={`button-edit-lt-${t.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              onClick={() => { setDeleteTarget(t); setDeleteError(""); }}
                              aria-label={`Deactivate ${t.name}`}
                              data-testid={`button-delete-lt-${t.id}`}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => setReactivateTarget(t)}
                            aria-label={`Reactivate ${t.name}`}
                            data-testid={`button-reactivate-lt-${t.id}`}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No leave types configured. Add one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeaveTypeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={initForm}
        saving={isSaving}
        key={editTarget?.id ?? "new"}
      />

      <AlertDialog
        open={!!reactivateTarget}
        onOpenChange={(v) => { if (!v) setReactivateTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate "{reactivateTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This leave type will become available again in the leave request form for employees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { if (reactivateTarget) reactivateMutation.mutate(reactivateTarget.id); }}
              disabled={reactivateMutation.isPending}
              data-testid="button-confirm-reactivate-lt"
            >
              {reactivateMutation.isPending ? "Reactivating…" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteError(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This leave type will be hidden from employees and cannot be selected for new requests.
              Existing approved leave and historical balances are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-red-500 px-1" data-testid="lt-delete-error">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-lt"
            >
              {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Holidays Panel ────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

function isUpcoming(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso + "T00:00:00") >= today;
}

function HolidaysPanel({ businessUnitId }: { businessUnitId: string | null }) {
  const queryClient = useQueryClient();
  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays", businessUnitId],
    queryFn: () => getHolidays(businessUnitId ? { businessUnitId } : undefined),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const createMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof updateHoliday>[1] }) =>
      updateHoliday(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDeleteTarget(null);
    },
  });

  const initForm = editTarget ? holFormFromHoliday(editTarget) : emptyHolForm();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(h: Holiday) { setEditTarget(h); setDialogOpen(true); }

  function handleSave(f: HolForm) {
    const year = f.isRecurring ? null : new Date(f.date + "T00:00:00").getUTCFullYear();
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: { name: f.name, date: f.date, isRecurring: f.isRecurring, year },
      });
    } else {
      if (!businessUnitId) return;
      createMutation.mutate({
        businessUnitId,
        name: f.name,
        date: f.date,
        isRecurring: f.isRecurring,
        year,
      });
    }
  }

  const upcoming = holidays.filter((h) => isUpcoming(h.date));
  const past = holidays.filter((h) => !isUpcoming(h.date));

  function HolidayTable({
    list,
    testIdPrefix,
  }: {
    list: Holiday[];
    testIdPrefix: string;
  }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Holiday</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Recurring</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((h) => (
            <TableRow key={h.id} data-testid={`row-hol-${h.id}`}>
              <TableCell>
                <p className="font-medium text-sm">{h.name}</p>
              </TableCell>
              <TableCell className="text-sm">{formatDate(h.date)}</TableCell>
              <TableCell>
                {h.isRecurring ? (
                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <RefreshCw className="w-3 h-3" /> Annual
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">One-time</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(h)}
                    data-testid={`button-edit-hol-${testIdPrefix}-${h.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setDeleteTarget(h)}
                    data-testid={`button-delete-hol-${testIdPrefix}-${h.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {upcoming.length} upcoming · {holidays.length} total
          </p>
          <p className="text-xs text-muted-foreground">
            {businessUnitId
              ? "Holidays are excluded from business-day calculations on leave requests"
              : "Select a business unit above to add or edit holidays"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={openAdd}
          disabled={!businessUnitId}
          data-testid="button-add-holiday"
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Holiday
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <HolidayTable list={upcoming} testIdPrefix="upcoming" />
              </CardContent>
            </Card>
          )}

          {past.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Past
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 opacity-60">
                <HolidayTable list={past} testIdPrefix="past" />
              </CardContent>
            </Card>
          )}

          {holidays.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No holidays configured. Add one above.
              </CardContent>
            </Card>
          )}
        </>
      )}

      <HolidayDialog
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
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This holiday will be removed from the calendar. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-hol"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Business Unit Selector ────────────────────────────────────────────────────
function BuSelector({
  businessUnits,
  value,
  onChange,
}: {
  businessUnits: BusinessUnit[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-52" data-testid="select-bu-filter">
          <SelectValue placeholder="All business units" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All business units</SelectItem>
          {businessUnits.map((bu) => (
            <SelectItem key={bu.id} value={bu.id}>
              {bu.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeaveManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("leave-types");

  const isAuthorized = user?.roles.some((r) => HR_ROLES.includes(r)) ?? false;
  const isGlobalRole = user?.roles.some((r) => HR_ROLES.includes(r)) ?? false;

  // HR_ADMIN / EXECUTIVE can switch BU; others are locked to their own BU.
  const [selectedBuId, setSelectedBuId] = useState<string | null>(
    isGlobalRole ? null : (user?.businessUnitId ?? null),
  );

  const { data: businessUnits = [] } = useQuery({
    queryKey: ["business-units"],
    queryFn: getBusinessUnits,
    enabled: isGlobalRole,
  });

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <ShieldCheck className="w-10 h-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Access restricted</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Leave management is only available to HR Admin and Executive roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-leave-management"
          >
            Leave Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure leave types and public holidays for your organisation
          </p>
        </div>

        {isGlobalRole && businessUnits.length > 0 && (
          <BuSelector
            businessUnits={businessUnits}
            value={selectedBuId}
            onChange={setSelectedBuId}
          />
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            data-testid={`tab-${id}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "leave-types" && <LeaveTypesPanel businessUnitId={selectedBuId} />}
      {tab === "holidays" && <HolidaysPanel businessUnitId={selectedBuId} />}
    </div>
  );
}
