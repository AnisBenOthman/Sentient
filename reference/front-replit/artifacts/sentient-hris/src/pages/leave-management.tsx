import { useState } from "react";
import {
  useLeaveTypes,
  useHolidays,
  COLOUR_OPTIONS,
  colourClass,
  type LeaveTypeConfig,
  type Holiday,
} from "@/lib/leave-config-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ListChecks,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/lib/mock-data";

const HR_ROLES = ["HR Admin", "Executive", "HR_ADMIN", "EXECUTIVE"];

// ── Tab ────────────────────────────────────────────────────────────────────────
type Tab = "leave-types" | "holidays";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "leave-types", label: "Leave Types",      icon: ListChecks },
  { id: "holidays",    label: "Public Holidays",  icon: Calendar   },
];

// ── Leave Type Dialog ─────────────────────────────────────────────────────────
type LTForm = {
  name: string;
  paid: boolean;
  maxDaysPerYear: string;
  color: string;
  enabled: boolean;
};

const emptyLTForm = (): LTForm => ({
  name: "",
  paid: true,
  maxDaysPerYear: "10",
  color: "blue",
  enabled: true,
});

function ltFormFromConfig(t: LeaveTypeConfig): LTForm {
  return {
    name: t.name,
    paid: t.paid,
    maxDaysPerYear: String(t.maxDaysPerYear),
    color: t.color,
    enabled: t.enabled,
  };
}

function LeaveTypeDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: LTForm) => void;
  initial: LTForm;
}) {
  const [form, setForm] = useState<LTForm>(initial);
  const [error, setError] = useState("");

  function reset(f: LTForm) {
    setForm(f);
    setError("");
  }

  function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    const days = Number(form.maxDaysPerYear);
    if (isNaN(days) || days < 0) { setError("Max days must be 0 or more (0 = unlimited)."); return; }
    onSave({ ...form, name: form.name.trim(), maxDaysPerYear: String(Math.round(days)) });
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
              <Label htmlFor="lt-max-days">Max days / year</Label>
              <Input
                id="lt-max-days"
                type="number"
                min={0}
                value={form.maxDaysPerYear}
                onChange={(e) => { setForm((p) => ({ ...p, maxDaysPerYear: e.target.value })); setError(""); }}
                placeholder="0 = unlimited"
                data-testid="input-lt-max-days"
              />
              <p className="text-xs text-muted-foreground">0 = unlimited</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lt-color">Colour</Label>
              <Select
                value={form.color}
                onValueChange={(v) => setForm((p) => ({ ...p, color: v }))}
              >
                <SelectTrigger id="lt-color" data-testid="select-lt-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOUR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-3 h-3 rounded-full inline-block", c.bg)} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Paid leave</p>
              <p className="text-xs text-muted-foreground">Employee is paid during this leave</p>
            </div>
            <Switch
              checked={form.paid}
              onCheckedChange={(v) => setForm((p) => ({ ...p, paid: v }))}
              data-testid="switch-lt-paid"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">Employees can select this type when requesting leave</p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
              data-testid="switch-lt-enabled"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500" data-testid="lt-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-lt">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Holiday Dialog ────────────────────────────────────────────────────────────
type HolForm = {
  name: string;
  date: string;
  description: string;
  recurring: boolean;
};

const emptyHolForm = (): HolForm => ({
  name: "",
  date: "",
  description: "",
  recurring: true,
});

function holFormFromHoliday(h: Holiday): HolForm {
  return { name: h.name, date: h.date, description: h.description, recurring: h.recurring };
}

function HolidayDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: HolForm) => void;
  initial: HolForm;
}) {
  const [form, setForm] = useState<HolForm>(initial);
  const [error, setError] = useState("");

  function handleSave() {
    if (!form.name.trim()) { setError("Holiday name is required."); return; }
    if (!form.date) { setError("Date is required."); return; }
    onSave({ ...form, name: form.name.trim(), description: form.description.trim() });
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

          <div className="space-y-1.5">
            <Label htmlFor="hol-desc">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="hol-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Short description…"
              data-testid="input-hol-desc"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Recurring annually</p>
              <p className="text-xs text-muted-foreground">Repeat this holiday every year on the same date</p>
            </div>
            <Switch
              checked={form.recurring}
              onCheckedChange={(v) => setForm((p) => ({ ...p, recurring: v }))}
              data-testid="switch-hol-recurring"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500" data-testid="hol-form-error">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-hol">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Leave Types Panel ─────────────────────────────────────────────────────────
function LeaveTypesPanel() {
  const { types, addType, updateType, deleteType } = useLeaveTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveTypeConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeConfig | null>(null);

  const initForm = editTarget ? ltFormFromConfig(editTarget) : emptyLTForm();

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(t: LeaveTypeConfig) { setEditTarget(t); setDialogOpen(true); }

  function handleSave(f: LTForm) {
    const days = Number(f.maxDaysPerYear);
    if (editTarget) {
      updateType(editTarget.id, {
        name: f.name, paid: f.paid, maxDaysPerYear: days, color: f.color, enabled: f.enabled,
      });
    } else {
      addType({ name: f.name, paid: f.paid, maxDaysPerYear: days, color: f.color, enabled: f.enabled });
    }
    setDialogOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {types.filter((t) => t.enabled).length} active · {types.length} total
          </p>
          <p className="text-xs text-muted-foreground">
            These types appear in the leave request form for employees
          </p>
        </div>
        <Button size="sm" onClick={openAdd} data-testid="button-add-lt">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Type
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Max days / year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} data-testid={`row-lt-${t.id}`}>
                  <TableCell>
                    <Badge className={cn("font-medium", colourClass(t.color))} variant="outline">
                      {t.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        t.paid
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {t.paid ? "Paid" : "Unpaid"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.maxDaysPerYear === 0 ? (
                      <span className="text-muted-foreground">Unlimited</span>
                    ) : (
                      `${t.maxDaysPerYear} days`
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={t.enabled}
                      onCheckedChange={(v) => updateType(t.id, { enabled: v })}
                      aria-label={`Toggle ${t.name}`}
                      data-testid={`toggle-lt-${t.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(t)}
                        data-testid={`button-edit-lt-${t.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setDeleteTarget(t)}
                        data-testid={`button-delete-lt-${t.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No leave types configured. Add one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeaveTypeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={initForm}
        key={editTarget?.id ?? "new"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This leave type will be removed from configuration. Existing leave requests with this
              type will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { if (deleteTarget) deleteType(deleteTarget.id); setDeleteTarget(null); }}
              data-testid="button-confirm-delete-lt"
            >
              Delete
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

function HolidaysPanel() {
  const { holidays, addHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const initForm = editTarget ? holFormFromHoliday(editTarget) : emptyHolForm();

  function openAdd() { setEditTarget(null); setDialogOpen(true); }
  function openEdit(h: Holiday) { setEditTarget(h); setDialogOpen(true); }

  function handleSave(f: HolForm) {
    if (editTarget) {
      updateHoliday(editTarget.id, f);
    } else {
      addHoliday(f);
    }
    setDialogOpen(false);
  }

  const upcoming = holidays.filter((h) => isUpcoming(h.date));
  const past = holidays.filter((h) => !isUpcoming(h.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {upcoming.length} upcoming · {holidays.length} total
          </p>
          <p className="text-xs text-muted-foreground">
            Holidays are excluded from business-day calculations on leave requests
          </p>
        </div>
        <Button size="sm" onClick={openAdd} data-testid="button-add-holiday">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Holiday
        </Button>
      </div>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {upcoming.map((h) => (
                  <TableRow key={h.id} data-testid={`row-hol-${h.id}`}>
                    <TableCell>
                      <p className="font-medium text-sm">{h.name}</p>
                      {h.description && (
                        <p className="text-xs text-muted-foreground">{h.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(h.date)}</TableCell>
                    <TableCell>
                      {h.recurring ? (
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
                          data-testid={`button-edit-hol-${h.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteTarget(h)}
                          data-testid={`button-delete-hol-${h.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <CardContent className="p-0">
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
                {past.map((h) => (
                  <TableRow key={h.id} data-testid={`row-hol-${h.id}`} className="opacity-60">
                    <TableCell>
                      <p className="font-medium text-sm">{h.name}</p>
                      {h.description && (
                        <p className="text-xs text-muted-foreground">{h.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(h.date)}</TableCell>
                    <TableCell>
                      {h.recurring ? (
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
                          data-testid={`button-edit-hol-past-${h.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteTarget(h)}
                          data-testid={`button-delete-hol-past-${h.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      <HolidayDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={initForm}
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
              onClick={() => { if (deleteTarget) deleteHoliday(deleteTarget.id); setDeleteTarget(null); }}
              data-testid="button-confirm-delete-hol"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LeaveManagement() {
  const [tab, setTab] = useState<Tab>("leave-types");

  if (!HR_ROLES.includes(currentUser.role)) {
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
      {/* Header */}
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

      {/* Tabs */}
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
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {tab === "leave-types" && <LeaveTypesPanel />}
      {tab === "holidays"    && <HolidaysPanel />}
    </div>
  );
}
