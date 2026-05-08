import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getEmployees,
  getPendingLeaveQueue,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Users,
  Clock,
  CalendarCheck,
  CalendarX,
  UserCheck,
  Plane,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Tab = "overview" | "employees" | "leave";

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "employees", label: "Employees", icon: Users },
  { value: "leave", label: "Leave Queue", icon: CalendarCheck },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e",
  ON_LEAVE: "#f97316",
  PROBATION: "#eab308",
  TERMINATED: "#ef4444",
  RESIGNED: "#94a3b8",
};

const DEPT_CHART_COLORS = [
  "#3b82f6", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6",
  "#6366f1", "#14b8a6", "#f43f5e", "#a855f7", "#0ea5e9",
];

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: "12px",
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </CardTitle>
        <div className={`p-1.5 rounded-md ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function LeaveStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    PENDING: "bg-orange-100 text-orange-700 border-orange-200",
    APPROVED: "bg-green-100 text-green-700 border-green-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const label: Record<string, string> = {
    PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled",
  };
  return (
    <Badge className={cls[status] ?? "bg-gray-100 text-gray-600"} variant="outline">
      {label[status] ?? status}
    </Badge>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: result } = useQuery({
    queryKey: ["employees", { limit: 500 }],
    queryFn: () => getEmployees({ limit: 500 }),
  });

  const { data: pendingQueue = [] } = useQuery({
    queryKey: ["pending-leave-queue"],
    queryFn: getPendingLeaveQueue,
  });

  const employees = result?.data ?? [];
  const total = result?.total ?? employees.length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of employees) {
      counts[e.employmentStatus] = (counts[e.employmentStatus] ?? 0) + 1;
    }
    return counts;
  }, [employees]);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of employees) {
      const name = e.department?.name ?? "Unassigned";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [employees]);

  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, " "),
    value,
    fill: STATUS_COLORS[name] ?? "#94a3b8",
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={total}
          sub="All employment types"
          icon={Users}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30"
        />
        <StatCard
          title="Active"
          value={statusCounts["ACTIVE"] ?? 0}
          sub="Currently working"
          icon={UserCheck}
          color="bg-green-100 text-green-600 dark:bg-green-900/30"
        />
        <StatCard
          title="On Leave"
          value={statusCounts["ON_LEAVE"] ?? 0}
          sub="Away from office"
          icon={Plane}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingQueue.length}
          sub="Leave requests awaiting review"
          icon={Clock}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                  >
                    {statusPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusPieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: entry.fill }}
                      />
                      <span className="capitalize text-gray-700 dark:text-gray-300">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dept breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Headcount by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {deptCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptCounts} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Employees" radius={[0, 4, 4, 0]}>
                    {deptCounts.map((_, i) => (
                      <Cell key={i} fill={DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────
function EmployeesTab() {
  const { data: result, isLoading } = useQuery({
    queryKey: ["employees", { limit: 500 }],
    queryFn: () => getEmployees({ limit: 500 }),
  });

  const employees = result?.data ?? [];

  const deptGroups = useMemo(() => {
    const m = new Map<string, typeof employees>();
    for (const e of employees) {
      const key = e.department?.name ?? "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [employees]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-1 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Workforce Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Grouped by department</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptGroups.flatMap(([deptName, emps]) => [
                <TableRow
                  key={`group-${deptName}`}
                  className="bg-muted/40 hover:bg-muted/50"
                >
                  <TableCell colSpan={3} className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{deptName}</span>
                      <Badge variant="secondary" className="text-xs">{emps.length}</Badge>
                    </div>
                  </TableCell>
                </TableRow>,
                ...emps.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(emp.firstName, emp.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{emp.position?.title ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                          emp.employmentStatus === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : emp.employmentStatus === "ON_LEAVE"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : emp.employmentStatus === "PROBATION"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        )}
                      >
                        {emp.employmentStatus.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                )),
              ])}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Leave Queue Tab ───────────────────────────────────────────────────────────
function LeaveQueueTab() {
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["pending-leave-queue"],
    queryFn: getPendingLeaveQueue,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-leave-queue"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id, "Declined by manager"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-leave-queue"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-1 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pending Leave Requests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {queue.length} request{queue.length !== 1 ? "s" : ""} awaiting your review
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CalendarX className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
            No pending leave requests. You're all caught up!
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card">
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
              {queue.map((req) => (
                <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                  <TableCell>
                    {req.employee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {getInitials(req.employee.firstName, req.employee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {req.employee.firstName} {req.employee.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{req.employeeId}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{req.leaveType?.name ?? req.leaveTypeId}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.startDate} → {req.endDate}
                  </TableCell>
                  <TableCell className="text-sm">{req.totalDays}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50 h-7 px-2 text-xs"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${req.id}`}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                        onClick={() => rejectMutation.mutate(req.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${req.id}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const isManager = user?.roles.some((r) => ["MANAGER", "HR_ADMIN", "EXECUTIVE"].includes(r)) ?? false;

  const visibleTabs = TABS.filter((t) => t.value !== "leave" || isManager);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
          data-testid="heading-dashboard"
        >
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {user ? `Welcome back, ${user.employeeId ? "Employee" : "Admin"}` : "Organisation overview"}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {visibleTabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            data-testid={`tab-${value}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === value
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "employees" && <EmployeesTab />}
      {tab === "leave" && isManager && <LeaveQueueTab />}
    </div>
  );
}
