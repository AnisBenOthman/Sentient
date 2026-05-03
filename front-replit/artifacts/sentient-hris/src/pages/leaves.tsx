import { useState, useEffect } from "react";
import { currentUser } from "@/lib/mock-data";
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
import { CalendarDays, CheckCircle2, XCircle, Clock } from "lucide-react";

const LEAVE_TYPES = ["Annual", "Sick", "Personal", "Maternity", "Paternity", "Unpaid"];

const API_BASE = "/api";

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  daysCount: number;
  note?: string | null;
};

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

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Approved":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "Rejected":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-orange-500" />;
  }
};

function calcBusinessDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(count, 1);
}

export default function Leaves() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/leave-requests`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data: LeaveRequest[]) => {
        setRequests(data);
      })
      .catch(() => {
        setError("Failed to load leave requests.");
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingRequests = requests.filter((r) => r.status === "Pending").length;
  const approvedThisMonth = requests.filter((r) => r.status === "Approved").length;

  const myPending = requests.filter(
    (r) => r.employeeId === currentUser.id && r.status === "Pending"
  ).length;
  const myApproved = requests.filter(
    (r) => r.employeeId === currentUser.id && r.status === "Approved"
  ).length;

  const approve = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/leave-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      const updated: LeaveRequest = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError("Failed to approve request. Please try again.");
    }
  };

  const reject = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/leave-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      const updated: LeaveRequest = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setError("Failed to reject request. Please try again.");
    }
  };

  const openModal = () => {
    setLeaveType("");
    setStartDate("");
    setEndDate("");
    setNote("");
    setError("");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!leaveType) {
      setError("Please select a leave type.");
      return;
    }
    if (!startDate) {
      setError("Please select a start date.");
      return;
    }
    if (!endDate) {
      setError("Please select an end date.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after the start date.");
      return;
    }

    const daysCount = calcBusinessDays(startDate, endDate);
    const payload = {
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      type: leaveType,
      startDate,
      endDate,
      daysCount,
      note: note.trim() || undefined,
    };

    try {
      const res = await fetch(`${API_BASE}/leave-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to submit");
      const created: LeaveRequest = await res.json();
      setRequests((prev) => [created, ...prev]);
      setOpen(false);
    } catch {
      setError("Failed to submit request. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
            data-testid="heading-leaves"
          >
            Leaves
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Approve requests and view team availability
          </p>
        </div>
        <Button data-testid="button-new-leave" onClick={openModal}>
          Record Leave
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Pending Approvals"
          value={pendingRequests}
          sub="Requests requiring attention"
          icon={Clock}
        />
        <StatCard
          title="My Pending Leaves"
          value={myPending}
          sub="Your submitted requests"
          icon={CalendarDays}
        />
        <StatCard
          title="My Approved Leaves"
          value={myApproved}
          sub="Approved this year"
          icon={CheckCircle2}
        />
        <StatCard
          title="Approved This Month"
          value={approvedThisMonth}
          sub="Across all departments"
          icon={CalendarDays}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>All team leave applications</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                    <TableCell className="font-medium">
                      {req.employeeName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{req.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.startDate} to {req.endDate}
                    </TableCell>
                    <TableCell>{req.daysCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(req.status)}
                        <span className="text-sm font-medium">{req.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "Pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            data-testid={`button-approve-${req.id}`}
                            onClick={() => approve(req.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            data-testid={`button-reject-${req.id}`}
                            onClick={() => reject(req.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
              <Select value={leaveType} onValueChange={(v) => { setLeaveType(v); setError(""); }}>
                <SelectTrigger id="leave-type" data-testid="select-leave-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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
                  onChange={(e) => { setStartDate(e.target.value); setError(""); }}
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
                  onChange={(e) => { setEndDate(e.target.value); setError(""); }}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">
                Note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="note"
                placeholder="Any additional details…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                data-testid="textarea-note"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500" data-testid="form-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="button-submit-leave">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
