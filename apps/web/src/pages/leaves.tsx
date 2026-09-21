import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyLeaveRequests,
  getLeaveTypes,
  createLeaveRequest,
  cancelLeaveRequest,
  getPendingLeaveQueue,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveBalances,
  type LeaveBalance,
} from "@/lib/api/hr-core";
import { getGatewayErrorMessage } from "@/lib/api/gateway-error";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider";
import { LeaveRequestSummary } from "@/components/leave-request-summary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  Plus,
  Users,
  Check,
  X,
} from "lucide-react";

function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  const { t } = useTranslation("leaves");
  const color = balance.leaveType?.color ?? "#6366f1";
  const usedPct = balance.totalDays > 0 ? Math.min(100, Math.round((balance.usedDays / balance.totalDays) * 100)) : 0;
  const pendingPct = balance.totalDays > 0 ? Math.min(100 - usedPct, Math.round((balance.pendingDays / balance.totalDays) * 100)) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
      <div className="pl-2.5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-2">
            {balance.leaveTypeName}
          </p>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
              {balance.remainingDays}
            </span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("balances.left")}</p>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-2">
          <div className="h-full flex">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${usedPct}%`, backgroundColor: color }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${pendingPct}%`, backgroundColor: color, opacity: 0.3 }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("balances.used", { count: balance.usedDays })}</span>
          {balance.pendingDays > 0 && (
            <span className="text-orange-500 font-medium">{t("balances.pending", { count: balance.pendingDays })}</span>
          )}
          <span>{t("balances.total", { count: balance.totalDays })}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color = "#6366f1",
}: {
  title: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />
      <div className="pl-2.5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
            {title}
          </p>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}1a` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">
          {value}
        </div>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

// Labels live in `leaves:status.*`; only icon and colour belong at module scope.
const STATUS_META: Record<string, { Icon: React.ElementType; cls: string }> = {
  PENDING: { Icon: Clock, cls: "text-orange-500" },
  APPROVED: { Icon: CheckCircle2, cls: "text-green-500" },
  REJECTED: { Icon: XCircle, cls: "text-red-500" },
  CANCELLED: { Icon: MinusCircle, cls: "text-gray-400" },
  ESCALATED: { Icon: Clock, cls: "text-purple-500" },
};

export default function Leaves() {
  const { t } = useTranslation("leaves");
  // Literal keys keep i18next's typed `t` checking them; the lookup key itself
  // is the raw status string the API returns.
  const statusLabels: Record<string, string> = {
    PENDING: t("status.PENDING"),
    APPROVED: t("status.APPROVED"),
    REJECTED: t("status.REJECTED"),
    CANCELLED: t("status.CANCELLED"),
    ESCALATED: t("status.ESCALATED"),
  };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const buId = user?.businessUnitId ?? undefined;
  const isManager = user?.roles.some((r) => ["MANAGER", "HR_ADMIN"].includes(r)) ?? false;
  const currentYear = new Date().getFullYear();

  // New leave request dialog
  const [open, setOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Manager-level inline error for approve
  const [reviewError, setReviewError] = useState("");

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["leave-balances", user?.employeeId, currentYear],
    queryFn: () => getLeaveBalances(user!.employeeId ?? "", currentYear),
    enabled: !!user?.employeeId,
    staleTime: 60_000,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: () => getMyLeaveRequests(),
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types", buId],
    queryFn: () => getLeaveTypes(buId ? { businessUnitId: buId } : undefined),
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ["pending-leave-queue"],
    queryFn: getPendingLeaveQueue,
    enabled: isManager,
  });

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = getGatewayErrorMessage(err, "");
      setFormError(
        msg === "InsufficientBalance"
          ? t("errors.InsufficientBalance")
          : msg === "LeaveTypeInactive"
          ? t("errors.LeaveTypeInactive")
          : msg === "LeaveTypeOutOfScope"
          ? t("errors.LeaveTypeOutOfScope")
          : msg === "ZeroDayRequest"
          ? t("errors.ZeroDayRequest")
          : msg === "OverlappingRequest"
          ? t("errors.OverlappingRequest")
          : t("errors.generic"),
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leave-queue"] });
      setReviewError("");
    },
    onError: (err: unknown) => {
      const msg = getGatewayErrorMessage(err, "");
      setReviewError(
        msg === "RequestAlreadyDecided"
          ? t("errors.RequestAlreadyDecided")
          : t("errors.approveFailed"),
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectLeaveRequest(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-leave-queue"] });
      setRejectOpen(false);
      setRejectNote("");
      setRejectError("");
    },
    onError: (err: unknown) => {
      const msg = getGatewayErrorMessage(err, "");
      setRejectError(
        msg === "RequestAlreadyDecided"
          ? t("errors.RequestAlreadyDecided")
          : t("errors.rejectFailed"),
      );
    },
  });

  const thisMonth = new Date().toISOString().slice(0, 7);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const approvedThisMonth = requests.filter(
    (r) => r.status === "APPROVED" && r.startDate.startsWith(thisMonth),
  ).length;
  const cancelledCount = requests.filter((r) => r.status === "CANCELLED").length;

  function openModal() {
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setFormError("");
    setOpen(true);
  }

  function handleSubmit() {
    if (!leaveTypeId) { setFormError(t("validation.selectType")); return; }
    if (!startDate) { setFormError(t("validation.selectStart")); return; }
    if (!endDate) { setFormError(t("validation.selectEnd")); return; }
    if (endDate < startDate) { setFormError(t("validation.endAfterStart")); return; }
    setFormError("");
    createMutation.mutate({ leaveTypeId, startDate, endDate, reason: reason.trim() || undefined });
  }

  function openRejectDialog(id: string) {
    setRejectTargetId(id);
    setRejectNote("");
    setRejectError("");
    setRejectOpen(true);
  }

  function handleReject() {
    if (!rejectNote.trim()) { setRejectError(t("validation.rejectReason")); return; }
    rejectMutation.mutate({ id: rejectTargetId, note: rejectNote.trim() });
  }

  const myLeavesContent = (
    <>
      {/* Leave balance per type */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("balances.heading", { year: currentYear })}
          </h2>
          {!balancesLoading && balances.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("balances.remainingAll", {
                count: balances.reduce((s, b) => s + b.remainingDays, 0),
              })}
            </span>
          )}
        </div>
        {balancesLoading ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-7 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
                <div className="flex justify-between">
                  <div className="h-2.5 w-1/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-2.5 w-1/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("balances.noBalances")}</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {balances.map((b) => (
              <LeaveBalanceCard key={b.id} balance={b} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title={t("stats.pending")} value={pendingCount} sub={t("stats.pendingSub")} icon={Clock} color="#f97316" />
        <StatCard title={t("stats.approved")} value={approvedCount} sub={t("stats.approvedSub")} icon={CheckCircle2} color="#22c55e" />
        <StatCard title={t("stats.thisMonth")} value={approvedThisMonth} sub={t("stats.thisMonthSub")} icon={CalendarDays} color="#6366f1" />
        <StatCard title={t("stats.cancelled")} value={cancelledCount} sub={t("stats.cancelledSub")} icon={XCircle} color="#94a3b8" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("myRequests.title")}</CardTitle>
          <CardDescription>{t("myRequests.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("myRequests.loading")}</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("myRequests.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.type")}</TableHead>
                  <TableHead>{t("table.duration")}</TableHead>
                  <TableHead>{t("table.days")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const meta = STATUS_META[req.status] ?? STATUS_META["PENDING"];
                  const StatusIcon = meta.Icon;
                  return (
                    <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                      <TableCell>
                        <LeaveRequestSummary request={req} mode="type" />
                      </TableCell>
                      <TableCell className="text-sm">
                        <LeaveRequestSummary request={req} mode="duration" />
                      </TableCell>
                      <TableCell>{req.totalDays}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${meta.cls}`} />
                          <span className="text-sm font-medium">{statusLabels[req.status] ?? req.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-${req.id}`}
                          >
                            {t("actions.cancel")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );

  const teamRequestsContent = (
    <Card>
      <CardHeader>
        <CardTitle>{t("teamRequests.title")}</CardTitle>
        <CardDescription>{t("teamRequests.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {reviewError && (
          <p className="mb-3 text-sm text-red-500">{reviewError}</p>
        )}
        {queueLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("teamRequests.loading")}</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("teamRequests.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.employee")}</TableHead>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead>{t("table.duration")}</TableHead>
                <TableHead>{t("table.days")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {req.employee
                      ? `${req.employee.firstName} ${req.employee.lastName}`
                      : req.employeeId}
                  </TableCell>
                  <TableCell>
                    <LeaveRequestSummary request={req} mode="type" />
                  </TableCell>
                  <TableCell className="text-sm">
                    <LeaveRequestSummary request={req} mode="duration" />
                  </TableCell>
                  <TableCell>{req.totalDays}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-200 hover:bg-green-50 gap-1"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t("actions.approve")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                        onClick={() => openRejectDialog(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <X className="w-3.5 h-3.5" />
                        {t("actions.reject")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-leaves"
          >
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Button
          data-testid="button-new-leave"
          onClick={openModal}
          className="rounded-full px-6 gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold shadow-md hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          {t("newRequest")}
        </Button>
      </div>

      {isManager ? (
        <Tabs defaultValue="my-leaves">
          <TabsList>
            <TabsTrigger value="my-leaves">{t("tabs.myLeaves")}</TabsTrigger>
            <TabsTrigger value="team-requests" className="gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t("tabs.teamRequests")}
              {queue.length > 0 && (
                <span className="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600">
                  {queue.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my-leaves" className="space-y-6 mt-4">
            {myLeavesContent}
          </TabsContent>
          <TabsContent value="team-requests" className="mt-4">
            {teamRequestsContent}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">{myLeavesContent}</div>
      )}

      {/* New leave request dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-record-leave">
          <DialogHeader>
            <DialogTitle>{t("dialog.newRequestTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="leave-type">{t("dialog.leaveTypeLabel")}</Label>
              <Select
                value={leaveTypeId}
                onValueChange={(v) => { setLeaveTypeId(v); setFormError(""); }}
              >
                <SelectTrigger id="leave-type" data-testid="select-leave-type">
                  <SelectValue placeholder={t("dialog.leaveTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">{t("dialog.startDateLabel")}</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setFormError(""); }}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">{t("dialog.endDateLabel")}</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => { setEndDate(e.target.value); setFormError(""); }}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">
                {t("table.reason")} <span className="text-muted-foreground">{t("dialog.reasonOptional")}</span>
              </Label>
              <Textarea
                id="reason"
                placeholder={t("dialog.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                data-testid="textarea-note"
              />
            </div>

            {formError && (
              <p className="text-sm text-red-500" data-testid="form-error">
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-leave"
            >
              {createMutation.isPending ? t("dialog.submitting") : t("dialog.submitButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject leave request dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => { if (!v) { setRejectOpen(false); setRejectNote(""); setRejectError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.rejectTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reject-note">{t("dialog.rejectReasonLabel")}</Label>
              <Textarea
                id="reject-note"
                placeholder={t("dialog.rejectPlaceholder")}
                value={rejectNote}
                onChange={(e) => { setRejectNote(e.target.value); setRejectError(""); }}
                rows={4}
              />
            </div>
            {rejectError && (
              <p className="text-sm text-red-500">{rejectError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRejectOpen(false); setRejectNote(""); setRejectError(""); }}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? t("dialog.rejecting") : t("dialog.rejectButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
