import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DashboardScopeFilter,
  type DashboardScopeSelection,
} from "@/components/dashboard-scope-filter";
import { DashboardPeriodFilter } from "@/components/dashboard-period-filter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  approvePromotionRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  rejectPromotionRequest,
  getBusinessUnits,
  getDashboardAnalytics,
  getDepartments,
  getEmployees,
  getPendingLeaveQueue,
  getPromotionRequestsDashboard,
  getTeams,
  getThresholdIndicators,
  type ChartPoint,
  type DashboardAnalytics,
  type PromotionRequestsDashboard,
  type SeriesPoint,
  type TimeGranularity,
} from "@/lib/api/hr-core";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart as BarChartBaseIcon,
  BarChart2,
  BarChart3,
  BarChart4,
  Briefcase,
  Cake,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  GraduationCap,
  Heart,
  Hourglass,
  LayoutDashboard,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  XCircle,
  AreaChart as AreaChartIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "employees" | "leave" | "skills" | "pay" | "promotions" | "engagement";

type ScopeParams = {
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
};

type ChartType = "area" | "line" | "column" | "bar" | "donut" | "stacked" | "clustered";

type ChartTypeState = {
  get: (id: string, fallback?: ChartType) => ChartType;
  set: (id: string, type: ChartType) => void;
};

function granularitySubtitle(g: TimeGranularity): string {
  return g === "YEARLY" ? "Last 5 years" : g === "QUARTERLY" ? "Last 8 quarters" : "Last 12 months";
}

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "employees", label: "Employees", icon: Users },
  { value: "leave", label: "Leave Queue", icon: CalendarCheck },
  { value: "skills", label: "Skills", icon: Sparkles },
  { value: "pay", label: "Pay", icon: Wallet },
  { value: "promotions", label: "Promotions", icon: Trophy },
  { value: "engagement", label: "Engagement", icon: Star },
];

function isDashboardTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.value === value);
}

function initialDashboardTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return isDashboardTab(tab) ? tab : "overview";
}

const CHART_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

const BRAND = "#6366f1";

type CardStatus = "normal" | "warning" | "critical";

interface ThresholdConfig {
  label?: string;
  warning?: number;
  critical?: number;
  warningBelow?: number;
  criticalBelow?: number;
}

function computeCardStatus(value: number, cfg: ThresholdConfig): CardStatus {
  if (cfg.critical !== undefined && value >= cfg.critical) return "critical";
  if (cfg.warning  !== undefined && value >= cfg.warning)  return "warning";
  if (cfg.criticalBelow !== undefined && value <= cfg.criticalBelow) return "critical";
  if (cfg.warningBelow  !== undefined && value <= cfg.warningBelow)  return "warning";
  return "normal";
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const STATUS_COLOR: Record<CardStatus, string> = {
  normal:   "",
  warning:  "#d97706",
  critical: "#dc2626",
};

const STATUS_TONE: Record<Exclude<CardStatus, "normal">, {
  frame: string;
  badge: string;
  icon: string;
  glow: string;
  label: string;
}> = {
  warning: {
    frame: "border-amber-500/80 bg-amber-50 text-amber-950 shadow-amber-500/15 ring-1 ring-amber-500/25 dark:bg-amber-950/30 dark:text-amber-50",
    badge: "bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200",
    glow: "bg-amber-400/20",
    label: "Warning",
  },
  critical: {
    frame: "border-red-600/90 bg-red-50 text-red-950 shadow-red-600/20 ring-1 ring-red-600/30 dark:bg-red-950/35 dark:text-red-50",
    badge: "bg-red-600 text-red-50 dark:bg-red-500 dark:text-red-50",
    icon: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200",
    glow: "bg-red-500/20",
    label: "Critical",
  },
};

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color = "#6366f1",
  status = "normal",
  statusLabel,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  color?: string;
  status?: CardStatus;
  statusLabel?: string;
}) {
  const resolvedColor = status !== "normal" ? STATUS_COLOR[status] : color;
  const isAlert = status !== "normal";
  const tone = isAlert ? STATUS_TONE[status] : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md",
        tone?.frame,
      )}
    >
      {isAlert && (
        <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", tone?.glow)} />
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className={cn("text-sm font-semibold leading-tight", isAlert ? "text-current" : "text-gray-800 dark:text-gray-200")}>
            {title}
          </p>
          <div
            className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", tone?.icon)}
            style={isAlert ? undefined : { backgroundColor: `${resolvedColor}20` }}
          >
            <Icon className="w-4 h-4" style={{ color: resolvedColor }} />
          </div>
        </div>
        <div className={cn("text-2xl font-bold leading-none mb-1", isAlert ? "text-current" : "text-gray-900 dark:text-gray-100")}>
          {value}
        </div>
        <p className={cn("text-[11px]", isAlert ? "text-current/70" : "text-muted-foreground")}>{sub}</p>

        {isAlert && statusLabel && (
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              tone?.badge,
            )}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            {tone?.label}: {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

interface RiskAlert {
  key: string;
  title: string;
  value: number | string;
  status: Exclude<CardStatus, "normal">;
  message: string;
}

function RiskAlertDeck({ alerts }: { alerts: RiskAlert[] }) {
  if (alerts.length === 0) return null;

  const hasCritical = alerts.some((alert) => alert.status === "critical");

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        hasCritical
          ? "border-red-600/70 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-50"
          : "border-amber-500/70 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              hasCritical ? "bg-red-600 text-red-50" : "bg-amber-500 text-amber-950",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">
              {hasCritical ? "Dashboard check required" : "Dashboard watchlist"}
            </p>
            <p className="text-xs text-current/70">
              {alerts.length} KPI{alerts.length === 1 ? "" : "s"} crossed configured risk thresholds.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {alerts.map((alert) => {
            const tone = STATUS_TONE[alert.status];
            return (
              <div key={alert.key} className="rounded-lg border border-current/15 bg-card/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-semibold">{alert.title}</p>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", tone.badge)}>
                    {tone.label}
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold leading-none">{alert.value}</p>
                <p className="mt-1 text-[11px] text-current/65">{alert.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) return "-";
  return `${value.toFixed(1)}${suffix}`;
}

function formatRatio(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(0)}%`;
}

function pointTotal(data: ChartPoint[]): number {
  return data.reduce((sum, item) => sum + item.value, 0);
}

function topPointLabel(data: ChartPoint[]): string {
  return data[0]?.label ?? "-";
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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${BRAND}14` }} />
        <Bar dataKey="value" name={valueName} fill={BRAND} radius={[0, 4, 4, 0]} />
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
  const gradId = `grad-${valueName.replace(/\s+/g, "")}`;
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={BRAND} stopOpacity={0.18} />
            <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke={BRAND}
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: BRAND, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PointColumnChart({
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
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${BRAND}14` }} />
        <Bar dataKey="value" name={valueName} fill={BRAND} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PointLineOnlyChart({
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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke={BRAND}
          strokeWidth={2.5}
          dot={{ r: 0 }}
          activeDot={{ r: 4, fill: BRAND, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SeriesStackedBarChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const keys = seriesKeys(data);
  if (data.length === 0 || keys.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} stackId="total" fill={CHART_COLORS[index % CHART_COLORS.length]} radius={index === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data, height = 240 }: { data: ChartPoint[]; height?: number }) {
  if (data.length === 0) return <EmptyChart />;
  const normalized = data.map((d) => ({ name: d.label, value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={normalized}
          cx="50%"
          cy="50%"
          innerRadius="45%"
          outerRadius="70%"
          paddingAngle={2}
          dataKey="value"
        >
          {normalized.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

function SeriesClusteredBarChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const keys = seriesKeys(data);
  if (data.length === 0 || keys.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CHART_TYPE_ICONS: Record<ChartType, React.ElementType> = {
  area: AreaChartIcon,
  line: TrendingUp,
  column: BarChart3,
  bar: BarChart2,
  donut: PieChartIcon,
  stacked: BarChart4,
  clustered: BarChartBaseIcon,
};

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  area: "Area",
  line: "Line",
  column: "Column",
  bar: "Bar (horizontal)",
  donut: "Donut",
  stacked: "Stacked",
  clustered: "Clustered",
};

function ChartTypeToggle({
  id,
  types,
  cts,
}: {
  id: string;
  types: ChartType[];
  cts: ChartTypeState;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {types.map((t) => {
        const Icon = CHART_TYPE_ICONS[t];
        return (
          <button
            key={t}
            onClick={() => cts.set(id, t)}
            className={cn(
              "rounded p-1 text-muted-foreground transition-colors hover:text-foreground",
              cts.get(id) === t && "bg-muted text-foreground",
            )}
            title={CHART_TYPE_LABELS[t]}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function SwitchableChartCard({
  id,
  title,
  subtitle,
  types,
  cts,
  renderChart,
}: {
  id: string;
  title: string;
  subtitle: string;
  types: ChartType[];
  cts: ChartTypeState;
  renderChart: (type: ChartType) => React.ReactNode;
}) {
  const first: ChartType = types[0] ?? "area";
  const stored = cts.get(id, first);
  const activeType: ChartType = (types as string[]).includes(stored) ? stored : first;
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      action={<ChartTypeToggle id={id} types={types} cts={cts} />}
    >
      {renderChart(activeType)}
    </ChartCard>
  );
}

function OverviewTab({
  analytics,
  granularity,
  cts,
  thresholdMap,
}: {
  analytics: DashboardAnalytics | undefined;
  granularity: TimeGranularity;
  cts: ChartTypeState;
  thresholdMap: Record<string, ThresholdConfig>;
}) {
  if (!analytics) return <EmptyChart label="Loading analytics..." />;
  const trendSubtitle = granularitySubtitle(granularity);

  const ovExitsStatus     = computeCardStatus(analytics.employees.terminal,            thresholdMap['EMPLOYEES_EXITS']             ?? {});
  const ovAttritionStatus = computeCardStatus(analytics.employees.attritionRate ?? 0, thresholdMap['EMPLOYEES_ATTRITION_RATE']    ?? {});
  const ovProbationStatus = computeCardStatus(analytics.employees.probation,          thresholdMap['EMPLOYEES_PROBATION']         ?? {});
  const ovPendingStatus   = computeCardStatus(analytics.leave.pendingApprovals,       thresholdMap['LEAVE_PENDING_APPROVALS']     ?? {});
  const overviewRiskAlerts: RiskAlert[] = [
    ...(ovProbationStatus === "normal" ? [] : [{
      key: "EMPLOYEES_PROBATION",
      title: "Probation",
      value: analytics.employees.probation,
      status: ovProbationStatus,
      message: ovProbationStatus === "critical" ? "High caseload" : "Review caseload",
    }]),
    ...(ovExitsStatus === "normal" ? [] : [{
      key: "EMPLOYEES_EXITS",
      title: "Exits",
      value: analytics.employees.terminal,
      status: ovExitsStatus,
      message: ovExitsStatus === "critical" ? "Retention risk" : "Monitor exits",
    }]),
    ...(ovAttritionStatus === "normal" ? [] : [{
      key: "EMPLOYEES_ATTRITION_RATE",
      title: "Exit Rate",
      value: formatRatio(analytics.employees.attritionRate),
      status: ovAttritionStatus,
      message: ovAttritionStatus === "critical" ? "Critical attrition" : "Elevated attrition",
    }]),
    ...(ovPendingStatus === "normal" ? [] : [{
      key: "LEAVE_PENDING_APPROVALS",
      title: "Pending Approvals",
      value: analytics.leave.pendingApprovals,
      status: ovPendingStatus,
      message: ovPendingStatus === "critical" ? "Immediate review" : "Queue building",
    }]),
  ];

  return (
    <div className="space-y-6">
      <RiskAlertDeck alerts={overviewRiskAlerts} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Employees" value={analytics.employees.total} sub="Visible in current scope" icon={Users} color="#2563eb" />
        <StatCard title="Active" value={analytics.employees.active} sub="Currently working" icon={UserCheck} color="#16a34a" />
        <StatCard title="On Leave" value={analytics.employees.onLeave} sub="Away from office" icon={Plane} color="#ea580c" />
        <StatCard
          title="Probation"
          value={analytics.employees.probation}
          sub="Current probation cases"
          icon={Hourglass}
          color="#d97706"
          status={ovProbationStatus}
          statusLabel={ovProbationStatus === "critical" ? "High caseload" : ovProbationStatus === "warning" ? "Review caseload" : undefined}
        />
        <StatCard
          title="Exits"
          value={analytics.employees.terminal}
          sub="Terminated or resigned"
          icon={UserX}
          color="#dc2626"
          status={ovExitsStatus}
          statusLabel={ovExitsStatus === "critical" ? "Retention risk" : ovExitsStatus === "warning" ? "Monitor exits" : undefined}
        />
        <StatCard title="New Hires" value={analytics.employees.newHiresOnProbation} sub="Hired in last 6 months" icon={UserPlus} color="#0d9488" />
        <StatCard title="Avg Age" value={formatMetric(analytics.employees.averageAge)} sub="Current workforce" icon={Cake} color="#db2777" />
        <StatCard title="Avg Tenure" value={formatMetric(analytics.employees.averageTenureYears, " yrs")} sub="Current workforce" icon={Briefcase} color="#4f46e5" />
        <StatCard title="Full-Time" value={formatRatio(analytics.employees.fullTimeRatio)} sub="Current workforce mix" icon={ShieldCheck} color="#0891b2" />
        <StatCard
          title="Exit Rate"
          value={formatRatio(analytics.employees.attritionRate)}
          sub="Exits in visible people"
          icon={LineChartIcon}
          color="#475569"
          status={ovAttritionStatus}
          statusLabel={ovAttritionStatus === "critical" ? "Critical attrition" : ovAttritionStatus === "warning" ? "Elevated attrition" : undefined}
        />
        <StatCard
          title="Pending Approvals"
          value={analytics.leave.pendingApprovals}
          sub="Leave requests awaiting review"
          icon={Clock}
          color="#9333ea"
          status={ovPendingStatus}
          statusLabel={ovPendingStatus === "critical" ? "Needs immediate review" : ovPendingStatus === "warning" ? "Growing backlog" : undefined}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SwitchableChartCard
          id="ov-headcount"
          title="Headcount over time"
          subtitle={trendSubtitle}
          types={["area", "line", "column"]}
          cts={cts}
          renderChart={(type) =>
            type === "column" ? (
              <PointColumnChart data={analytics.employees.headcountOverTime} valueName="Headcount" />
            ) : type === "line" ? (
              <PointLineOnlyChart data={analytics.employees.headcountOverTime} valueName="Headcount" />
            ) : (
              <PointLineChart data={analytics.employees.headcountOverTime} valueName="Headcount" />
            )
          }
        />
        <SwitchableChartCard
          id="ov-leave-type"
          title="Leave requests by type"
          subtitle={trendSubtitle}
          types={["stacked", "clustered", "line"]}
          cts={cts}
          renderChart={(type) =>
            type === "stacked" ? (
              <SeriesStackedBarChart data={analytics.leave.requestsByTypeOverTime} />
            ) : type === "clustered" ? (
              <SeriesClusteredBarChart data={analytics.leave.requestsByTypeOverTime} />
            ) : (
              <SeriesLineChart data={analytics.leave.requestsByTypeOverTime} />
            )
          }
        />
        <SwitchableChartCard
          id="ov-age"
          title="Age distribution"
          subtitle="Current workforce by age band"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics.employees.ageBands} />
            ) : (
              <PointBarChart data={analytics.employees.ageBands} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="ov-tenure"
          title="Tenure distribution"
          subtitle="Current workforce by service length"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics.employees.tenureBands} />
            ) : (
              <PointBarChart data={analytics.employees.tenureBands} valueName="Employees" />
            )
          }
        />
      </div>
    </div>
  );
}

function EmployeesTab({
  analytics,
  scopeParams,
  granularity,
  cts,
  thresholdMap,
}: {
  analytics: DashboardAnalytics | undefined;
  scopeParams: ScopeParams;
  granularity: TimeGranularity;
  thresholdMap: Record<string, ThresholdConfig>;
  cts: ChartTypeState;
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

  const trendSubtitle = granularitySubtitle(granularity);

  const empProbationStatus = computeCardStatus(analytics?.employees.probation ?? 0, thresholdMap['EMPLOYEES_PROBATION'] ?? {});
  const empExitsStatus     = computeCardStatus(analytics?.employees.terminal  ?? 0, thresholdMap['EMPLOYEES_EXITS']     ?? {});
  const educationFields = analytics?.employees.educationFields ?? [];
  const genderDistribution = analytics?.employees.genderDistribution ?? [];
  const attritionByMaritalStatus = analytics?.employees.attritionByMaritalStatus ?? [];
  const attritionByJob = analytics?.employees.attritionByJob ?? [];
  const educationFieldTotal = pointTotal(educationFields);
  const genderTotal = pointTotal(genderDistribution);
  const attritionByMaritalTotal = pointTotal(attritionByMaritalStatus);
  const attritionByJobTotal = pointTotal(attritionByJob);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Users} title="Employees" subtitle="Headcount and hiring movement from HR Core" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Employees" value={analytics?.employees.total ?? 0} sub="Visible in current scope" icon={Users} color="#2563eb" />
        <StatCard title="Active" value={analytics?.employees.active ?? 0} sub="Currently working" icon={UserCheck} color="#16a34a" />
        <StatCard
          title="Probation"
          value={analytics?.employees.probation ?? 0}
          sub="Early-tenure monitoring"
          icon={Hourglass}
          color="#d97706"
          status={empProbationStatus}
          statusLabel={empProbationStatus === "critical" ? "High caseload" : empProbationStatus === "warning" ? "Review caseload" : undefined}
        />
        <StatCard title="New Hires (Probation)" value={analytics?.employees.newHiresOnProbation ?? 0} sub="Hired in last 6 months" icon={UserPlus} color="#0d9488" />
        <StatCard title="Avg Age" value={formatMetric(analytics?.employees.averageAge ?? null)} sub="Current workforce" icon={Cake} color="#db2777" />
        <StatCard title="Avg Tenure" value={formatMetric(analytics?.employees.averageTenureYears ?? null, " yrs")} sub="Current workforce" icon={Briefcase} color="#4f46e5" />
        <StatCard title="Full-Time Ratio" value={formatRatio(analytics?.employees.fullTimeRatio ?? null)} sub="Current workforce" icon={ShieldCheck} color="#0891b2" />
        <StatCard
          title="Exits"
          value={analytics?.employees.terminal ?? 0}
          sub="Terminated or resigned"
          icon={UserX}
          color="#dc2626"
          status={empExitsStatus}
          statusLabel={empExitsStatus === "critical" ? "Retention risk" : empExitsStatus === "warning" ? "Monitor exits" : undefined}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Top Education Field" value={topPointLabel(educationFields)} sub={`${educationFieldTotal} current employees classified`} icon={GraduationCap} color="#7c3aed" />
        <StatCard title="Gender Records" value={genderTotal} sub="Employees with demographic grouping" icon={UserCheck} color="#0f766e" />
        <StatCard title="Marital Attrition" value={attritionByMaritalTotal} sub="Exited employees with marital status" icon={Heart} color="#be123c" />
        <StatCard title="Job Attrition" value={attritionByJobTotal} sub="Exited employees by position" icon={Briefcase} color="#a16207" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SwitchableChartCard
          id="emp-headcount"
          title="Headcount over time"
          subtitle={trendSubtitle}
          types={["area", "line", "column"]}
          cts={cts}
          renderChart={(type) =>
            type === "column" ? (
              <PointColumnChart data={analytics?.employees.headcountOverTime ?? []} valueName="Headcount" />
            ) : type === "line" ? (
              <PointLineOnlyChart data={analytics?.employees.headcountOverTime ?? []} valueName="Headcount" />
            ) : (
              <PointLineChart data={analytics?.employees.headcountOverTime ?? []} valueName="Headcount" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-newhires"
          title="New hire trend"
          subtitle={trendSubtitle}
          types={["column", "line", "area"]}
          cts={cts}
          renderChart={(type) =>
            type === "area" ? (
              <PointLineChart data={analytics?.employees.newHiresTrend ?? []} valueName="New Hires" />
            ) : type === "line" ? (
              <PointLineOnlyChart data={analytics?.employees.newHiresTrend ?? []} valueName="New Hires" />
            ) : (
              <PointColumnChart data={analytics?.employees.newHiresTrend ?? []} valueName="New Hires" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-status"
          title="Status breakdown"
          subtitle="All visible people by employment status"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics?.employees.statusBreakdown ?? []} />
            ) : (
              <PointBarChart data={analytics?.employees.statusBreakdown ?? []} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-contract"
          title="Contract mix"
          subtitle="Current workforce by contract type"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics?.employees.contractMix ?? []} />
            ) : (
              <PointBarChart data={analytics?.employees.contractMix ?? []} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-age"
          title="Age bands"
          subtitle="Current workforce distribution"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics?.employees.ageBands ?? []} />
            ) : (
              <PointBarChart data={analytics?.employees.ageBands ?? []} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-tenure"
          title="Tenure bands"
          subtitle="Current workforce service length"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics?.employees.tenureBands ?? []} />
            ) : (
              <PointBarChart data={analytics?.employees.tenureBands ?? []} valueName="Employees" />
            )
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SwitchableChartCard
          id="emp-education-level"
          title="Education level mix"
          subtitle="Current workforce credentials by highest level"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={analytics?.employees.educationLevels ?? []} />
            ) : (
              <PointBarChart data={analytics?.employees.educationLevels ?? []} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-education-field"
          title="Education field concentration"
          subtitle="Top fields across the current workforce"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={educationFields} />
            ) : (
              <PointBarChart data={educationFields} valueName="Employees" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-gender"
          title="Total employees by gender"
          subtitle="Visible employees grouped by recorded gender"
          types={["donut", "bar"]}
          cts={cts}
          renderChart={(type) =>
            type === "bar" ? (
              <PointBarChart data={genderDistribution} valueName="Employees" />
            ) : (
              <DonutChart data={genderDistribution} />
            )
          }
        />
        <SwitchableChartCard
          id="emp-attrition-marital"
          title="Attrition by marital status"
          subtitle="Terminated or resigned employees by marital status"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={attritionByMaritalStatus} />
            ) : (
              <PointBarChart data={attritionByMaritalStatus} valueName="Exits" />
            )
          }
        />
        <SwitchableChartCard
          id="emp-attrition-job"
          title="Attrition by job"
          subtitle="Top positions represented in exits"
          types={["bar", "donut"]}
          cts={cts}
          renderChart={(type) =>
            type === "donut" ? (
              <DonutChart data={attritionByJob} />
            ) : (
              <PointBarChart data={attritionByJob} valueName="Exits" />
            )
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-1">
        <SwitchableChartCard
          id="emp-dept-hires"
          title="New hires by department"
          subtitle={trendSubtitle}
          types={["bar", "line"]}
          cts={cts}
          renderChart={(type) =>
            type === "line" ? (
              <SeriesLineChart data={analytics?.employees.newHiresByDepartment ?? []} height={280} />
            ) : (
              <SeriesStackedBarChart data={analytics?.employees.newHiresByDepartment ?? []} height={280} />
            )
          }
        />
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

function LeaveQueueTab({
  analytics,
  granularity,
  cts,
  thresholdMap,
}: {
  analytics: DashboardAnalytics | undefined;
  granularity: TimeGranularity;
  cts: ChartTypeState;
  thresholdMap: Record<string, ThresholdConfig>;
}) {
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

  const trendSubtitle = granularitySubtitle(granularity);

  const lvPendingStatus = computeCardStatus(analytics?.leave.pendingApprovals ?? 0, thresholdMap['LEAVE_PENDING_APPROVALS'] ?? {});

  return (
    <div className="space-y-6">
      <SectionHeader icon={CalendarCheck} title="Leave" subtitle="Approval workload and leave demand from HR Core" color="bg-orange-100 text-orange-600 dark:bg-orange-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending Approvals"
          value={analytics?.leave.pendingApprovals ?? 0}
          sub="Visible in current scope"
          icon={Clock}
          color="#9333ea"
          status={lvPendingStatus}
          statusLabel={lvPendingStatus === "critical" ? "Needs immediate review" : lvPendingStatus === "warning" ? "Growing backlog" : undefined}
        />
        <StatCard title="Leave Days" value={(analytics?.leave.daysByDepartment ?? []).reduce((sum, item) => sum + item.value, 0)} sub="Requested days in chart window" icon={Plane} color="#ea580c" />
        <StatCard title="Leave Types" value={seriesKeys(analytics?.leave.requestsByTypeOverTime ?? []).length} sub="Represented in trend" icon={CalendarCheck} color="#2563eb" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Leave days per department" subtitle="Total requested days">
          <PointBarChart data={analytics?.leave.daysByDepartment ?? []} valueName="Days" />
        </ChartCard>
        <SwitchableChartCard
          id="leave-type-trend"
          title="Leave requests by type over time"
          subtitle={trendSubtitle}
          types={["line", "bar"]}
          cts={cts}
          renderChart={(type) =>
            type === "bar" ? (
              <SeriesStackedBarChart data={analytics?.leave.requestsByTypeOverTime ?? []} />
            ) : (
              <SeriesLineChart data={analytics?.leave.requestsByTypeOverTime ?? []} />
            )
          }
        />
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

function SkillsTab({
  analytics,
  granularity,
  cts,
}: {
  analytics: DashboardAnalytics | undefined;
  granularity: TimeGranularity;
  cts: ChartTypeState;
}) {
  const radarData = analytics?.skills.radar ?? [];
  const trendSubtitle = granularitySubtitle(granularity);
  return (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="Skills" subtitle="Current skill coverage and proficiency evolution" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Avg Skill Score" value={analytics?.skills.averageScore ?? "-"} sub="Out of 4 proficiency levels" icon={Sparkles} color="#7c3aed" />
        <StatCard title="Skills Tracked" value={analytics?.skills.skillsTracked ?? 0} sub="Unique skills in scope" icon={ShieldCheck} color="#2563eb" />
        <StatCard title="Top Skill" value={analytics?.skills.topSkill ?? "-"} sub="Highest average proficiency" icon={Star} color="#d97706" />
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
        <SwitchableChartCard
          id="skills-evolution"
          title="Skill evolution"
          subtitle={trendSubtitle}
          types={["area", "line", "bar"]}
          cts={cts}
          renderChart={(type) =>
            type === "bar" ? (
              <PointColumnChart data={analytics?.skills.skillEvolution ?? []} valueName="Avg score" />
            ) : type === "line" ? (
              <PointLineOnlyChart data={analytics?.skills.skillEvolution ?? []} valueName="Avg score" />
            ) : (
              <PointLineChart data={analytics?.skills.skillEvolution ?? []} valueName="Avg score" />
            )
          }
        />
      </div>
    </div>
  );
}

function PayTab({
  analytics,
  granularity,
  cts,
}: {
  analytics: DashboardAnalytics | undefined;
  granularity: TimeGranularity;
  cts: ChartTypeState;
}) {
  const trendSubtitle = granularitySubtitle(granularity);
  return (
    <div className="space-y-6">
      <SectionHeader icon={Wallet} title="Payroll" subtitle="Compensation analytics from employee salaries and salary history" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Payroll Cost" value={formatMoney(analytics?.payroll.totalCost ?? null)} sub="Current gross salary total" icon={Wallet} color="#059669" />
        <StatCard title="Average Salary" value={formatMoney(analytics?.payroll.averageSalary ?? null)} sub="Visible to HR/Admin roles" icon={LineChartIcon} color="#2563eb" />
        <StatCard title="Payroll Access" value={analytics?.payroll.visible ? "Visible" : "Restricted"} sub="Based on role permissions" icon={ShieldCheck} color="#7c3aed" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Wages per department" subtitle="Current gross salary total">
          <PointBarChart data={analytics?.payroll.costByDepartment ?? []} valueName="Gross salary" />
        </ChartCard>
        <SwitchableChartCard
          id="pay-cost-trend"
          title="Payroll cost trends"
          subtitle={trendSubtitle}
          types={["line", "bar"]}
          cts={cts}
          renderChart={(type) =>
            type === "bar" ? (
              <SeriesStackedBarChart data={analytics?.payroll.costTrendByTeam ?? []} />
            ) : (
              <SeriesLineChart data={analytics?.payroll.costTrendByTeam ?? []} />
            )
          }
        />
      </div>
    </div>
  );
}

function PromotionsTab({
  dashboard,
  isLoading,
  year,
  onYearChange,
  canReview,
  thresholdMap,
}: {
  dashboard: PromotionRequestsDashboard | undefined;
  isLoading: boolean;
  year: number;
  onYearChange: (year: number) => void;
  canReview: boolean;
  thresholdMap: Record<string, ThresholdConfig>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);
  const requests = dashboard?.requests ?? [];
  const pendingReviewRequests = requests.filter((request) => request.status === "PENDING");
  const reviewDisabled = isLoading;

  const approvePromotionMutation = useMutation({
    mutationFn: (id: string) => approvePromotionRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-requests-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      toast({ title: "Promotion request validated" });
    },
    onError: () => {
      toast({
        title: "Could not validate request",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
    },
  });

  const rejectPromotionMutation = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote: string }) =>
      rejectPromotionRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-requests-dashboard"] });
      toast({ title: "Promotion request refused" });
    },
    onError: () => {
      toast({
        title: "Could not refuse request",
        description: "Please refresh and try again.",
        variant: "destructive",
      });
    },
  });

  function handleReject(id: string): void {
    const reviewNote = window.prompt("Reason for refusal");
    if (!reviewNote?.trim()) return;
    rejectPromotionMutation.mutate({ id, reviewNote: reviewNote.trim() });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <SectionHeader icon={Trophy} title="Promotions" subtitle="Promotion requests by year and organization scope" color="bg-amber-100 text-amber-600 dark:bg-amber-900/30" />
        <div className="w-full md:w-44">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Year</p>
          <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
            <SelectTrigger data-testid="select-promotion-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(() => {
        const promoPendingStatus = computeCardStatus(dashboard?.pendingRequests ?? 0, thresholdMap['PROMOTIONS_PENDING_REQUESTS'] ?? {});
        return (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Requests" value={dashboard?.totalRequests ?? 0} sub={`Submitted in ${year}`} icon={Trophy} color="#d97706" />
            <StatCard title="Avg Salary Lift" value={formatMoney(dashboard?.averageSalaryLift ?? 0)} sub="Average proposed increase" icon={LineChartIcon} color="#2563eb" />
            <StatCard title="Total Budget Impact" value={formatMoney(dashboard?.totalBudgetImpact ?? 0)} sub="Combined proposed lift" icon={Wallet} color="#059669" />
            <StatCard
              title="Pending Requests"
              value={dashboard?.pendingRequests ?? 0}
              sub="Awaiting review"
              icon={Clock}
              color="#7c3aed"
              status={promoPendingStatus}
              statusLabel={promoPendingStatus === "critical" ? "Needs immediate review" : promoPendingStatus === "warning" ? "Review queue building" : undefined}
            />
          </div>
        );
      })()}

      {canReview && pendingReviewRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending HR Decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReviewRequests.map((request) => (
              <div
                key={`decision-${request.id}`}
                className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                data-testid={`pending-promotion-decision-${request.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{request.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.teamName} - {request.currentRole} -&gt; {request.newRole} - {formatMoney(request.salaryDelta)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs text-emerald-700"
                    onClick={() => approvePromotionMutation.mutate(request.id)}
                    disabled={reviewDisabled || approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                    data-testid={`button-validate-promotion-card-${request.id}`}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs text-red-700"
                    onClick={() => handleReject(request.id)}
                    disabled={reviewDisabled || approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                    data-testid={`button-refuse-promotion-card-${request.id}`}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Refuse
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Promotion Request Details</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading promotion requests...</p>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No promotion requests match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Role Change</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Salary Lift</TableHead>
                    <TableHead className="text-right">Lift %</TableHead>
                    <TableHead className="text-right">Budget Impact</TableHead>
                    {canReview && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.employeeName}</TableCell>
                      <TableCell>
                        <div className="text-sm">{request.departmentName}</div>
                        <div className="text-xs text-muted-foreground">{request.teamName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[240px] text-sm">
                          <span>{request.currentRole}</span>
                          <span className="px-1.5 text-muted-foreground">-&gt;</span>
                          <span className="font-medium text-blue-700 dark:text-blue-400">{request.newRole}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(request.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn(
                          "capitalize",
                          request.status === "PENDING" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                          request.status === "APPROVED" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                          request.status === "REJECTED" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                        )}>
                          {request.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(request.salaryDelta)}</TableCell>
                      <TableCell className="text-right">{formatPercent(request.salaryDeltaPercentage)}</TableCell>
                      <TableCell className="text-right">
                        <div>{formatMoney(request.salaryDelta)}</div>
                        <div className="text-xs text-muted-foreground">{formatPercent(request.budgetImpactPercentage)}</div>
                      </TableCell>
                      {canReview && (
                        <TableCell className="text-right">
                          {request.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs text-emerald-700"
                                onClick={() => approvePromotionMutation.mutate(request.id)}
                                disabled={reviewDisabled || approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                                data-testid={`button-validate-promotion-${request.id}`}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Validate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs text-red-700"
                                onClick={() => handleReject(request.id)}
                                disabled={reviewDisabled || approvePromotionMutation.isPending || rejectPromotionMutation.isPending}
                                data-testid={`button-refuse-promotion-${request.id}`}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Refuse
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Reviewed</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
  const [tab, setTab] = useState<Tab>(initialDashboardTab);
  const [scopeSelection, setScopeSelection] = useState<DashboardScopeSelection>({
    businessUnitId: null,
    departmentId: null,
    teamId: null,
  });
  const [promotionYear, setPromotionYear] = useState<number>(() => new Date().getFullYear());
  const [granularity, setGranularity] = useState<TimeGranularity>("MONTHLY");
  const [chartTypeMap, setChartTypeMap] = useState<Record<string, ChartType>>({});
  const cts: ChartTypeState = {
    get: (id, fallback = "bar") => chartTypeMap[id] ?? fallback,
    set: (id, type) => setChartTypeMap((prev) => ({ ...prev, [id]: type })),
  };

  const roles = user?.roles ?? [];
  const roleAssignments = user?.roleAssignments ?? [];
  const hasManagerRole = roles.includes("MANAGER");
  const hasPrivilegedDashboard = roles.some((role) => ["HR_ADMIN", "GLOBAL_HR_ADMIN", "EXECUTIVE"].includes(role));
  const canReviewPromotions =
    roles.some((role) => ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(role)) ||
    roleAssignments.some((assignment) => ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(assignment.roleCode));
  const isManager = hasManagerRole || hasPrivilegedDashboard;
  const canUseGlobalScope = Boolean(
    hasPrivilegedDashboard ||
    roleAssignments.some((assignment) => assignment.scope === "GLOBAL" && assignment.roleCode !== "MANAGER"),
  );
  const businessUnitAssignment = roleAssignments.find((assignment) => assignment.scope === "BUSINESS_UNIT");

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

  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );
  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );

  const forcedScope = useMemo(() => {
    if (!hasManagerRole || hasPrivilegedDashboard) return null;

    const departmentAssignment = roleAssignments.find((assignment) => assignment.scope === "DEPARTMENT");
    if (departmentAssignment?.scopeEntityId) return { level: "dept" as const, unitId: departmentAssignment.scopeEntityId };

    const teamAssignment = roleAssignments.find((assignment) => assignment.scope === "TEAM");
    if (teamAssignment?.scopeEntityId) return { level: "team" as const, unitId: teamAssignment.scopeEntityId };

    if (user?.teamId) {
      return { level: "team" as const, unitId: user.teamId };
    }
    return null;
  }, [hasManagerRole, hasPrivilegedDashboard, roleAssignments, user?.teamId]);

  const allowedBusinessUnits = useMemo(
    () => businessUnits.filter((businessUnit) => !businessUnitAssignment?.scopeEntityId || businessUnit.id === businessUnitAssignment.scopeEntityId),
    [businessUnitAssignment?.scopeEntityId, businessUnits],
  );

  const effectiveScopeSelection = useMemo<DashboardScopeSelection>(() => {
    if (forcedScope?.level === "team") {
      const team = teamById.get(forcedScope.unitId);
      const department = team ? departmentById.get(team.departmentId) : null;
      return {
        businessUnitId: department?.businessUnitId ?? null,
        departmentId: team?.departmentId ?? null,
        teamId: forcedScope.unitId,
      };
    }

    if (forcedScope?.level === "dept") {
      const department = departmentById.get(forcedScope.unitId);
      return {
        businessUnitId: department?.businessUnitId ?? null,
        departmentId: forcedScope.unitId,
        teamId: null,
      };
    }

    const pinnedBusinessUnitId = businessUnitAssignment?.scopeEntityId ?? null;
    const businessUnitId = pinnedBusinessUnitId ?? scopeSelection.businessUnitId;
    const department = scopeSelection.departmentId ? departmentById.get(scopeSelection.departmentId) : null;
    const departmentId = department?.businessUnitId === businessUnitId ? department.id : null;
    const team = scopeSelection.teamId ? teamById.get(scopeSelection.teamId) : null;
    const teamId = team && team.departmentId === departmentId ? team.id : null;

    return { businessUnitId, departmentId, teamId };
  }, [businessUnitAssignment?.scopeEntityId, departmentById, forcedScope, scopeSelection, teamById]);

  const scopeParams = useMemo<ScopeParams>(() => {
    if (effectiveScopeSelection.teamId) return { teamId: effectiveScopeSelection.teamId };
    if (effectiveScopeSelection.departmentId) return { departmentId: effectiveScopeSelection.departmentId };
    if (effectiveScopeSelection.businessUnitId) return { businessUnitId: effectiveScopeSelection.businessUnitId };
    return {};
  }, [effectiveScopeSelection]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics", scopeParams, granularity],
    queryFn: () => getDashboardAnalytics({ ...scopeParams, granularity }),
    enabled: Boolean(user),
  });

  const promotionDashboardParams = useMemo(
    () => ({ ...scopeParams, year: promotionYear }),
    [promotionYear, scopeParams],
  );

  const { data: promotionDashboard, isLoading: promotionDashboardLoading } = useQuery({
    queryKey: ["promotion-requests-dashboard", promotionDashboardParams],
    queryFn: () => getPromotionRequestsDashboard(promotionDashboardParams),
    enabled: Boolean(user),
  });

  const { data: thresholdIndicators = [] } = useQuery({
    queryKey: ["threshold-indicators"],
    queryFn: getThresholdIndicators,
    staleTime: 60_000,
    enabled: Boolean(user),
  });

  const thresholdMap = useMemo<Record<string, ThresholdConfig>>(
    () => Object.fromEntries(
      thresholdIndicators.map((t) => [t.metricKey, {
        label:         t.label,
        warning:       t.warningThreshold  ?? undefined,
        critical:      t.criticalThreshold ?? undefined,
        warningBelow:  t.warningBelow      ?? undefined,
        criticalBelow: t.criticalBelow     ?? undefined,
      }])
    ),
    [thresholdIndicators],
  );

  const visibleTabs = TABS.filter((item) => item.value !== "leave" || isManager);

  function handleScopeChange(nextSelection: DashboardScopeSelection): void {
    setScopeSelection({
      businessUnitId: businessUnitAssignment?.scopeEntityId ?? nextSelection.businessUnitId,
      departmentId: nextSelection.departmentId,
      teamId: nextSelection.teamId,
    });
  }

  function selectTab(nextTab: Tab): void {
    setTab(nextTab);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextTab === "overview") {
      url.searchParams.delete("tab");
      url.searchParams.delete("requestId");
    } else {
      url.searchParams.set("tab", nextTab);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {(canUseGlobalScope || businessUnitAssignment || forcedScope) ? (
          <DashboardScopeFilter
            businessUnits={allowedBusinessUnits}
            departments={departments}
            teams={teams}
            value={effectiveScopeSelection}
            canUseGlobal={canUseGlobalScope && !businessUnitAssignment && !forcedScope}
            disabled={Boolean(forcedScope)}
            onChange={forcedScope ? () => undefined : handleScopeChange}
          />
        ) : (
          <div />
        )}
        <DashboardPeriodFilter value={granularity} onChange={setGranularity} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {visibleTabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => selectTab(value)}
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

      {tab === "overview" && <OverviewTab analytics={analytics} granularity={granularity} cts={cts} thresholdMap={thresholdMap} />}
      {tab === "employees" && <EmployeesTab analytics={analytics} scopeParams={scopeParams} granularity={granularity} cts={cts} thresholdMap={thresholdMap} />}
      {tab === "leave" && isManager && <LeaveQueueTab analytics={analytics} granularity={granularity} cts={cts} thresholdMap={thresholdMap} />}
      {tab === "skills" && <SkillsTab analytics={analytics} granularity={granularity} cts={cts} />}
      {tab === "pay" && <PayTab analytics={analytics} granularity={granularity} cts={cts} />}
      {tab === "promotions" && (
        <PromotionsTab
          dashboard={promotionDashboard}
          isLoading={promotionDashboardLoading}
          year={promotionYear}
          onYearChange={setPromotionYear}
          canReview={canReviewPromotions}
          thresholdMap={thresholdMap}
        />
      )}
      {tab === "engagement" && <EngagementTab analytics={analytics} />}
    </div>
  );
}
