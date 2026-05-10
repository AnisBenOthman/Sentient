import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyLeaveRequests,
  getLeaveTypes,
  createLeaveRequest,
  cancelLeaveRequest,
} from "@/lib/api/hr-core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { CalendarDays, CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: number;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

const STATUS_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  PENDING: { label: "Pending", Icon: Clock, cls: "text-orange-500" },
  APPROVED: { label: "Approved", Icon: CheckCircle2, cls: "text-green-500" },
  REJECTED: { label: "Rejected", Icon: XCircle, cls: "text-red-500" },
  CANCELLED: { label: "Cancelled", Icon: MinusCircle, cls: "text-gray-400" },
  ESCALATED: { label: "Escalated", Icon: Clock, cls: "text-purple-500" },
};

export default function Leaves() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: () => getMyLeaveRequests(),
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types"],
    queryFn: getLeaveTypes,
  });

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      setOpen(false);
    },
    onError: () => setFormError("Failed to submit request. Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] }),
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
    if (!leaveTypeId) { setFormError("Please select a leave type."); return; }
    if (!startDate) { setFormError("Please select a start date."); return; }
    if (!endDate) { setFormError("Please select an end date."); return; }
    if (endDate < startDate) { setFormError("End date must be on or after start date."); return; }
    setFormError("");
    createMutation.mutate({ leaveTypeId, startDate, endDate, reason: reason.trim() || undefined });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-leaves"
          >
            My Leaves
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View and manage your time-off requests
          </p>
        </div>
        <Button data-testid="button-new-leave" onClick={openModal}>
          Request Leave
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Pending" value={pendingCount} sub="Awaiting approval" icon={Clock} />
        <StatCard title="Approved" value={approvedCount} sub="Total approved" icon={CheckCircle2} />
        <StatCard title="This Month" value={approvedThisMonth} sub="Approved this month" icon={CalendarDays} />
        <StatCard title="Cancelled" value={cancelledCount} sub="Withdrawn requests" icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>All your leave applications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No leave requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const meta = STATUS_META[req.status] ?? STATUS_META["PENDING"];
                  const StatusIcon = meta.Icon;
                  return (
                    <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                      <TableCell>
                        <Badge variant="outline">
                          {req.leaveType?.name ?? req.leaveTypeId}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.startDate} → {req.endDate}
                      </TableCell>
                      <TableCell>{req.totalDays}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${meta.cls}`} />
                          <span className="text-sm font-medium">{meta.label}</span>
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
                            Cancel
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-record-leave">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="leave-type">Leave Type</Label>
              <Select
                value={leaveTypeId}
                onValueChange={(v) => { setLeaveTypeId(v); setFormError(""); }}
              >
                <SelectTrigger id="leave-type" data-testid="select-leave-type">
                  <SelectValue placeholder="Select type" />
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
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setFormError(""); }}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">End Date</Label>
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
                Reason <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Any additional details…"
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
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-leave"
            >
              {createMutation.isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
