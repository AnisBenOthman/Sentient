import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardScopeFilter } from "@/components/dashboard-scope-filter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  getBusinessUnits,
  getDashboardAnalytics,
  getDepartments,
  getEmployees,
  getPendingLeaveQueue,
  getTeams,
  type ChartPoint,
  type DashboardAnalytics,
  type SeriesPoint,
} from "@/lib/api/hr-core";
import { cn } from "@/lib/utils";
import type { ScopeLevel } from "@/lib/use-dashboard-scope";
import {
  CalendarCheck,
  CalendarX,
  Clock,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

type Tab = "overview" | "employees" | "leave" | "skills" | "pay" | "promotions" | "engagement";

type ScopeParams = {
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
};

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "employees", label: "Employees", icon: Users },
  { value: "leave", label: "Leave Queue", icon: CalendarCheck },
  { value: "skills", label: "Skills", icon: Sparkles },
  { value: "pay", label: "Pay", icon: Wallet },
  { value: "promotions", label: "Promotions", icon: Trophy },
  { value: "engagement", label: "Engagement", icon: Star },
];

const CHART_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#64748b",
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
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 pb-3 pt-1 dark:border-gray-800">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatMoney(value: number | null): string {
  if (value === null) return "Restricted";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function seriesKeys(data: SeriesPoint[]): string[] {
  const keys = new Set<string>();
  for (const point of data) {
    Object.keys(point).forEach((key) => {
      if (key !== "label") keys.add(key);
    });
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function EmptyChart({ label = "No data yet" }: { label?: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function PointBarChart({
  data,
  valueName,
  height = 240,
}: {
  data: ChartPoint[];
  valueName: string;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" name={valueName} radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PointLineChart({
  data,
  valueName,
  height = 220,
}: {
  data: ChartPoint[];
  valueName: string;
  height?: number;
}) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SeriesBarChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const keys = seriesKeys(data);
  if (data.length === 0 || keys.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} stackId="total" fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function SeriesLineChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const keys = seriesKeys(data);
  if (data.length === 0 || keys.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverviewTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  if (!analytics) return <EmptyChart label="Loading analytics..." />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Employees" value={analytics.employees.total} sub="Visible in current scope" icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
        <StatCard title="Active" value={analytics.employees.active} sub="Currently working" icon={UserCheck} color="bg-green-100 text-green-600 dark:bg-green-900/30" />
        <StatCard title="On Leave" value={analytics.employees.onLeave} sub="Away from office" icon={Plane} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30" />
        <StatCard title="New Hires" value={analytics.employees.newHiresOnProbation} sub="Hired in last 6 months" icon={UserPlus} color="bg-teal-100 text-teal-600 dark:bg-teal-900/30" />
        <StatCard title="Pending Approvals" value={analytics.leave.pendingApprovals} sub="Leave requests awaiting review" icon={Clock} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Headcount over time" subtitle="Last 12 months">
          <PointLineChart data={analytics.employees.headcountOverTime} valueName="Headcount" />
        </ChartCard>
        <ChartCard title="Leave requests by type" subtitle="Last 12 months">
          <SeriesLineChart data={analytics.leave.requestsByTypeOverTime} />
        </ChartCard>
      </div>
    </div>
  );
}

function EmployeesTab({
  analytics,
  scopeParams,
}: {
  analytics: DashboardAnalytics | undefined;
  scopeParams: ScopeParams;
}) {
  const { data: result, isLoading } = useQuery({
    queryKey: ["employees", { limit: 500, ...scopeParams }],
    queryFn: () => getEmployees({ limit: 500, ...scopeParams }),
  });

  const employees = result?.data ?? [];
  const deptGroups = useMemo(() => {
    const groups = new Map<string, typeof employees>();
    for (const employee of employees) {
      const key = employee.department?.name ?? "Unassigned";
      groups.set(key, [...(groups.get(key) ?? []), employee]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [employees]);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Users} title="Employees" subtitle="Headcount and hiring movement from HR Core" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Employees" value={analytics?.employees.total ?? 0} sub="Visible in current scope" icon={Users} color="bg-blue-100 text-blue-600" />
        <StatCard title="Active" value={analytics?.employees.active ?? 0} sub="Currently working" icon={UserCheck} color="bg-green-100 text-green-600" />
        <StatCard title="New Hires (Probation)" value={analytics?.employees.newHiresOnProbation ?? 0} sub="Hired in last 6 months" icon={UserPlus} color="bg-teal-100 text-teal-600" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Headcount over time" subtitle="Employees hired by month-end">
          <PointLineChart data={analytics?.employees.headcountOverTime ?? []} valueName="Headcount" />
        </ChartCard>
        <ChartCard title="New hire trend" subtitle="Monthly new hires globally (last 12 months)">
          <PointLineChart data={analytics?.employees.newHiresTrend ?? []} valueName="New Hires" />
        </ChartCard>
      </div>
      <div className="grid gap-6 lg:grid-cols-1">
        <ChartCard title="New hires by department" subtitle="Monthly new hires per department (last 12 months)">
          <SeriesBarChart data={analytics?.employees.newHiresByDepartment ?? []} height={280} />
        </ChartCard>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
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
              {deptGroups.flatMap(([deptName, groupEmployees]) => [
                <TableRow key={`group-${deptName}`} className="bg-muted/40 hover:bg-muted/50">
                  <TableCell colSpan={3} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{deptName}</span>
                      <Badge variant="secondary" className="text-xs">{groupEmployees.length}</Badge>
                    </div>
                  </TableCell>
                </TableRow>,
                ...groupEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(employee.firstName, employee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{employee.firstName} {employee.lastName}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{employee.position?.title ?? "-"}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        employee.employmentStatus === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : employee.employmentStatus === "ON_LEAVE"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                      )}>
                        {employee.employmentStatus.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LeaveQueueTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  const queryClient = useQueryClient();
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["pending-leave-queue"],
    queryFn: getPendingLeaveQueue,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id, "Declined by manager"),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="space-y-6">
      <SectionHeader icon={CalendarCheck} title="Leave" subtitle="Approval workload and leave demand from HR Core" color="bg-orange-100 text-orange-600 dark:bg-orange-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Pending Approvals" value={analytics?.leave.pendingApprovals ?? 0} sub="Visible in current scope" icon={Clock} color="bg-purple-100 text-purple-600" />
        <StatCard title="Leave Days" value={(analytics?.leave.daysByDepartment ?? []).reduce((sum, item) => sum + item.value, 0)} sub="Requested days in chart window" icon={Plane} color="bg-orange-100 text-orange-600" />
        <StatCard title="Leave Types" value={seriesKeys(analytics?.leave.requestsByTypeOverTime ?? []).length} sub="Represented in trend" icon={CalendarCheck} color="bg-blue-100 text-blue-600" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Leave days per department" subtitle="Total requested days">
          <PointBarChart data={analytics?.leave.daysByDepartment ?? []} valueName="Days" />
        </ChartCard>
        <ChartCard title="Leave requests by type over time" subtitle="Monthly request count">
          <SeriesLineChart data={analytics?.leave.requestsByTypeOverTime ?? []} />
        </ChartCard>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CalendarX className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            No pending leave requests. You're all caught up.
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((request) => (
                <TableRow key={request.id} data-testid={`row-leave-${request.id}`}>
                  <TableCell>{request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : request.employeeId}</TableCell>
                  <TableCell><Badge variant="outline">{request.leaveType?.name ?? request.leaveTypeId}</Badge></TableCell>
                  <TableCell className="text-sm">{request.startDate} to {request.endDate}</TableCell>
                  <TableCell className="text-sm">{request.totalDays}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600" onClick={() => approveMutation.mutate(request.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => rejectMutation.mutate(request.id)} disabled={approveMutation.isPending || rejectMutation.isPending}>
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

function SkillsTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  const radarData = analytics?.skills.radar ?? [];
  return (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="Skills" subtitle="Current skill coverage and proficiency evolution" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Avg Skill Score" value={analytics?.skills.averageScore ?? "-"} sub="Out of 4 proficiency levels" icon={Sparkles} color="bg-violet-100 text-violet-600" />
        <StatCard title="Skills Tracked" value={analytics?.skills.skillsTracked ?? 0} sub="Unique skills in scope" icon={ShieldCheck} color="bg-blue-100 text-blue-600" />
        <StatCard title="Top Skill" value={analytics?.skills.topSkill ?? "-"} sub="Highest average proficiency" icon={Star} color="bg-amber-100 text-amber-600" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Radar skills chart" subtitle="Average proficiency by skill">
          {radarData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <Radar dataKey="value" name="Average score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Skill evolution" subtitle="Quarterly average score from skill history">
          <PointLineChart data={analytics?.skills.skillEvolution ?? []} valueName="Avg score" />
        </ChartCard>
      </div>
    </div>
  );
}

function PayTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Wallet} title="Payroll" subtitle="Compensation analytics from employee salaries and salary history" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Payroll Cost" value={formatMoney(analytics?.payroll.totalCost ?? null)} sub="Current gross salary total" icon={Wallet} color="bg-emerald-100 text-emerald-600" />
        <StatCard title="Average Salary" value={formatMoney(analytics?.payroll.averageSalary ?? null)} sub="Visible to HR/Admin roles" icon={LineChartIcon} color="bg-blue-100 text-blue-600" />
        <StatCard title="Payroll Access" value={analytics?.payroll.visible ? "Visible" : "Restricted"} sub="Based on role permissions" icon={ShieldCheck} color="bg-violet-100 text-violet-600" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Wages per department" subtitle="Current gross salary total">
          <PointBarChart data={analytics?.payroll.costByDepartment ?? []} valueName="Gross salary" />
        </ChartCard>
        <ChartCard title="Payroll cost trends" subtitle="Quarterly salary changes by team">
          <SeriesLineChart data={analytics?.payroll.costTrendByTeam ?? []} />
        </ChartCard>
      </div>
    </div>
  );
}

function PromotionsTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Trophy} title="Promotions" subtitle="Promotion events derived from salary history" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Promotions" value={analytics?.promotions.total ?? 0} sub="Promotion salary changes" icon={Trophy} color="bg-amber-100 text-amber-600" />
        <StatCard title="Departments" value={analytics?.promotions.byDepartment.length ?? 0} sub="With promotion activity" icon={Users} color="bg-blue-100 text-blue-600" />
        <StatCard title="Recent Records" value={analytics?.promotions.recent.length ?? 0} sub="Latest promotion events" icon={Clock} color="bg-violet-100 text-violet-600" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Promotions by quarter" subtitle="Count of promotion salary changes over time">
          <PointLineChart data={analytics?.promotions.byQuarter ?? []} valueName="Promotions" />
        </ChartCard>
        <ChartCard title="Promotions by department" subtitle="Promotion count by department">
          <PointBarChart data={analytics?.promotions.byDepartment ?? []} valueName="Promotions" />
        </ChartCard>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Promotions</CardTitle></CardHeader>
        <CardContent>
          {(analytics?.promotions.recent.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No promotion records in the current window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead className="text-right">Raise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.promotions.recent.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>{promotion.employeeName}</TableCell>
                    <TableCell>{promotion.departmentName}</TableCell>
                    <TableCell>{new Date(promotion.effectiveDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(promotion.newGrossSalary - promotion.previousGrossSalary)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EngagementTab({ analytics }: { analytics: DashboardAnalytics | undefined }) {
  return (
    <div className="space-y-6">
      <SectionHeader icon={Star} title="Engagement" subtitle="Reserved for backend engagement analytics" color="bg-pink-100 text-pink-600 dark:bg-pink-900/30" />
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {analytics?.engagement.message ?? "Engagement analytics are waiting for backend implementation."}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>("global");
  const [scopeUnitId, setScopeUnitId] = useState<string | null>(null);

  const isManager = user?.roles.some((role) => ["MANAGER", "HR_ADMIN", "EXECUTIVE"].includes(role)) ?? false;
  const canUseGlobalScope =
    user?.roleAssignments.some((assignment) => assignment.scope === "GLOBAL") ??
    user?.roles.some((role) => ["HR_ADMIN", "GLOBAL_HR_ADMIN", "EXECUTIVE"].includes(role)) ??
    false;
  const businessUnitAssignment = user?.roleAssignments.find((assignment) => assignment.scope === "BUSINESS_UNIT");

  const { data: businessUnits = [] } = useQuery({
    queryKey: ["business-units", "dashboard-scope"],
    queryFn: getBusinessUnits,
    enabled: Boolean(user),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "dashboard-scope"],
    queryFn: getDepartments,
    enabled: Boolean(user),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams", "dashboard-scope"],
    queryFn: getTeams,
    enabled: Boolean(user),
  });

  const forcedScope = useMemo(() => {
    const teamAssignment = user?.roleAssignments.find((assignment) => assignment.scope === "TEAM");
    if (teamAssignment?.scopeEntityId) return { level: "team" as const, unitId: teamAssignment.scopeEntityId };
    const departmentAssignment = user?.roleAssignments.find((assignment) => assignment.scope === "DEPARTMENT");
    if (departmentAssignment?.scopeEntityId) return { level: "dept" as const, unitId: departmentAssignment.scopeEntityId };
    if (user?.roles.includes("EMPLOYEE") && !isManager && user.teamId) {
      return { level: "team" as const, unitId: user.teamId };
    }
    return null;
  }, [isManager, user]);

  const effectiveLevel = forcedScope?.level ?? (businessUnitAssignment && scopeLevel === "global" ? "bu" : scopeLevel);
  const effectiveUnitId = forcedScope?.unitId ?? (businessUnitAssignment && scopeLevel === "global" ? businessUnitAssignment.scopeEntityId : scopeUnitId);

  const unitOptions = useMemo(() => {
    if (effectiveLevel === "global") return [];
    if (effectiveLevel === "bu") {
      return businessUnits
        .filter((businessUnit) => !businessUnitAssignment?.scopeEntityId || businessUnit.id === businessUnitAssignment.scopeEntityId)
        .map((businessUnit) => ({ value: businessUnit.id, label: businessUnit.name }));
    }
    if (effectiveLevel === "dept") {
      const allowedBuId = user?.roleAssignments.find((assignment) => assignment.scope === "BUSINESS_UNIT")?.scopeEntityId;
      return departments
        .filter((department) => !allowedBuId || department.businessUnitId === allowedBuId)
        .map((department) => ({
          value: department.id,
          label: `${department.name} - ${department.businessUnit?.name ?? "Business unit"}`,
        }));
    }
    const allowedDepartmentId = forcedScope?.level === "dept" ? forcedScope.unitId : null;
    return teams
      .filter((team) => !allowedDepartmentId || team.departmentId === allowedDepartmentId)
      .map((team) => ({
        value: team.id,
        label: `${team.name} - ${team.department?.name ?? "Department"}`,
      }));
  }, [businessUnitAssignment, businessUnits, departments, effectiveLevel, forcedScope, teams, user?.roleAssignments]);

  const scopeParams = useMemo<ScopeParams>(() => {
    if (effectiveLevel === "bu" && effectiveUnitId) return { businessUnitId: effectiveUnitId };
    if (effectiveLevel === "dept" && effectiveUnitId) return { departmentId: effectiveUnitId };
    if (effectiveLevel === "team" && effectiveUnitId) return { teamId: effectiveUnitId };
    return {};
  }, [effectiveLevel, effectiveUnitId]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics", scopeParams],
    queryFn: () => getDashboardAnalytics(scopeParams),
    enabled: Boolean(user),
  });

  const visibleTabs = TABS.filter((item) => item.value !== "leave" || isManager);

  function handleScopeChange(nextLevel: ScopeLevel, nextUnitId?: string | null): void {
    setScopeLevel(nextLevel);
    if (nextLevel === "global") {
      setScopeUnitId(null);
      return;
    }
    if (nextUnitId !== undefined) {
      setScopeUnitId(nextUnitId);
      return;
    }
    const firstOption =
      nextLevel === "bu"
        ? businessUnits.find((businessUnit) => !businessUnitAssignment?.scopeEntityId || businessUnit.id === businessUnitAssignment.scopeEntityId)?.id
        : nextLevel === "dept"
          ? departments.find((department) => !businessUnitAssignment?.scopeEntityId || department.businessUnitId === businessUnitAssignment.scopeEntityId)?.id
          : teams[0]?.id;
    setScopeUnitId(firstOption ?? null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100" data-testid="heading-dashboard">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {analyticsLoading ? "Loading live analytics..." : "Live HR Core analytics"}
        </p>
      </div>

      {(canUseGlobalScope || businessUnitAssignment || forcedScope) && (
        <DashboardScopeFilter
          level={effectiveLevel}
          unitId={effectiveUnitId}
          unitOptions={unitOptions}
          onChange={forcedScope ? () => undefined : handleScopeChange}
        />
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {visibleTabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            data-testid={`tab-${value}`}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px",
              tab === value
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab analytics={analytics} />}
      {tab === "employees" && <EmployeesTab analytics={analytics} scopeParams={scopeParams} />}
      {tab === "leave" && isManager && <LeaveQueueTab analytics={analytics} />}
      {tab === "skills" && <SkillsTab analytics={analytics} />}
      {tab === "pay" && <PayTab analytics={analytics} />}
      {tab === "promotions" && <PromotionsTab analytics={analytics} />}
      {tab === "engagement" && <EngagementTab analytics={analytics} />}
    </div>
  );
}
