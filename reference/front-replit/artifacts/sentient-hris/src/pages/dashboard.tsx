import { useMemo, useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  metrics,
  leaveRequests,
  employees,
  currentUser,
  departmentSkills,
  employeeExtras,
  skillHistory,
  monthlyWindow,
  monthlyNewHires,
  monthlyLeavesByType,
} from "@/lib/mock-data";
import { useOrgStructure } from "@/lib/org-structure-store";
import {
  useDashboardScope,
  type DashboardTab,
} from "@/lib/use-dashboard-scope";
import { DashboardScopeFilter } from "@/components/dashboard-scope-filter";
import { getSkillsGap } from "@/lib/positions-api";
import type { SkillsGapResult } from "@/lib/mock-data";
import { getPromotionRequests, type PromotionRequest } from "@/lib/promotion-store";
import {
  usePerformanceReviews,
  type PerformanceReview,
} from "@/lib/performance-review-store";
import {
  Users,
  Clock,
  CalendarCheck,
  CalendarX,
  UserCheck,
  Plane,
  DollarSign,
  Wallet,
  CalendarDays,
  Sparkles,
  Layers,
  Trophy,
  LayoutDashboard,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Star,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";

const DEPT_LIST = ["Engineering", "Marketing", "HR", "Finance", "Product"];
const DEPT_COLORS: Record<string, string> = {
  Engineering: "#3b82f6",
  Marketing: "#ec4899",
  HR: "#f59e0b",
  Finance: "#10b981",
  Product: "#8b5cf6",
  Executive: "#6366f1",
};
const LEAVE_COLORS: Record<string, string> = {
  Annual: "#3b82f6",
  Sick: "#ef4444",
  Personal: "#8b5cf6",
};

const TAB_DEFS: {
  value: DashboardTab;
  label: string;
  icon: React.ElementType;
  emoji?: string;
}[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "employees", label: "Employees", icon: Users },
  { value: "leave", label: "Leave", icon: CalendarDays },
  { value: "skills", label: "Skills", icon: Sparkles },
  { value: "promotions", label: "Promotions", icon: Trophy },
  { value: "engagement", label: "Engagement", icon: Star, emoji: "😊" },
];

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: "12px",
};

function getStatusColor(status: string) {
  switch (status) {
    case "Pending":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "Approved":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "Rejected":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-1 border-b border-gray-200 dark:border-gray-800 pb-3">
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PURE ENGAGEMENT UTILITY — accepts scoped employee list + all reviews
// ============================================================
type EngagementAggregates = {
  environmentSatisfaction: number;
  jobSatisfaction: number;
  relationshipSatisfaction: number;
  workLifeBalance: number;
  avgTrainingPerReview: number;
  totalTrainingSessions: number;
  reviewCount: number;
};

function computeEngagementAggregates(
  scopedEmployeeIds: Set<string>,
  reviews: PerformanceReview[]
): EngagementAggregates | null {
  const filtered = reviews.filter((r) => scopedEmployeeIds.has(r.employeeId));
  if (filtered.length === 0) return null;
  const n = filtered.length;
  const avgField = (key: keyof PerformanceReview) =>
    Math.round(
      (filtered.reduce((s, r) => s + (r[key] as number), 0) / n) * 100
    ) / 100;
  return {
    environmentSatisfaction: avgField("environmentSatisfaction"),
    jobSatisfaction: avgField("jobSatisfaction"),
    relationshipSatisfaction: avgField("relationshipSatisfaction"),
    workLifeBalance: avgField("workLifeBalance"),
    avgTrainingPerReview: Math.round(
      filtered.reduce((s, r) => s + r.trainingOpportunitiesTaken, 0) / n
    ),
    totalTrainingSessions: filtered.reduce(
      (s, r) => s + r.trainingOpportunitiesTaken,
      0
    ),
    reviewCount: n,
  };
}

type EngagementBreakdownRow = {
  group: string;
  "😊 Env Satisfaction": number;
  "💼 Job Satisfaction": number;
  "🤝 Relationship": number;
  "⚖️ Work-Life": number;
  "📚 Training": number;
};

function computeEngagementBreakdown(
  level: "global" | "bu" | "dept" | "team",
  scopedEmployees: typeof employees,
  allReviews: PerformanceReview[],
  org: { businessUnits: { id: string; name: string }[]; departments: { id: string; name: string; buId: string }[]; teams: { id: string; name: string; departmentId: string }[] },
  unitId: string | null
): EngagementBreakdownRow[] {
  if (scopedEmployees.length === 0) return [];

  type Bucket = { label: string; ids: Set<string> };
  const buckets: Bucket[] = [];

  if (level === "global") {
    org.businessUnits.forEach((bu) => {
      const ids = new Set(
        scopedEmployees.filter((e) => e.buId === bu.id).map((e) => e.id)
      );
      if (ids.size > 0) buckets.push({ label: bu.name, ids });
    });
  } else if (level === "bu") {
    const deptsInBu = org.departments.filter((d) => d.buId === unitId);
    deptsInBu.forEach((dept) => {
      const ids = new Set(
        scopedEmployees.filter((e) => e.department === dept.name).map((e) => e.id)
      );
      if (ids.size > 0) buckets.push({ label: dept.name, ids });
    });
  } else if (level === "dept") {
    const dept = org.departments.find((d) => d.id === unitId);
    if (dept) {
      const teamsInDept = org.teams.filter((t) => t.departmentId === dept.id);
      teamsInDept.forEach((team) => {
        const ids = new Set(
          scopedEmployees
            .filter((e) => employeeExtras[e.id]?.team === team.name)
            .map((e) => e.id)
        );
        if (ids.size > 0) buckets.push({ label: team.name, ids });
      });
    }
  } else {
    // Team level — single bucket
    const ids = new Set(scopedEmployees.map((e) => e.id));
    if (ids.size > 0) buckets.push({ label: "Team", ids });
  }

  return buckets
    .map((b) => {
      const agg = computeEngagementAggregates(b.ids, allReviews);
      if (!agg) return null;
      return {
        group: b.label,
        "😊 Env Satisfaction": agg.environmentSatisfaction,
        "💼 Job Satisfaction": agg.jobSatisfaction,
        "🤝 Relationship": agg.relationshipSatisfaction,
        "⚖️ Work-Life": agg.workLifeBalance,
        "📚 Training": agg.avgTrainingPerReview,
      } satisfies EngagementBreakdownRow;
    })
    .filter((r): r is EngagementBreakdownRow => r !== null)
    .sort((a, b) => a.group.localeCompare(b.group));
}

function dateToQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.ceil((d.getUTCMonth() + 1) / 3);
  return `Q${q} ${d.getUTCFullYear()}`;
}

function computeEngagementTrend(
  scopedEmployeeIds: Set<string>,
  reviews: PerformanceReview[]
): { quarter: string; avg: number }[] {
  const filtered = reviews.filter((r) => scopedEmployeeIds.has(r.employeeId));
  if (filtered.length === 0) return [];

  const buckets = new Map<string, number[]>();
  for (const r of filtered) {
    const q = dateToQuarter(r.reviewDate);
    const score =
      (r.environmentSatisfaction +
        r.jobSatisfaction +
        r.relationshipSatisfaction +
        r.workLifeBalance) /
      4;
    const arr = buckets.get(q) ?? [];
    arr.push(score);
    buckets.set(q, arr);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => {
      const [aq, ay] = a.split(" ");
      const [bq, by] = b.split(" ");
      return Number(ay) - Number(by) || Number(aq.slice(1)) - Number(bq.slice(1));
    })
    .map(([quarter, scores]) => ({
      quarter,
      avg: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)),
    }));
}

export default function Dashboard() {
  const scope = useDashboardScope();
  const org = useOrgStructure();
  const {
    level,
    unitId,
    scopedEmployees,
    scopedLeaveRequests,
    scopeLabel,
    tab,
    setTab,
    unitOptions,
    setScope,
  } = scope;

  // ============================================================
  // EMPLOYEES SECTION DATA
  // ============================================================
  const totalEmployees =
    level === "global" ? metrics.totalHeadcount : scopedEmployees.length;
  const activeEmployees = scopedEmployees.filter(
    (e) => e.status === "active"
  ).length;
  const onLeaveOrRemote = scopedEmployees.filter(
    (e) => e.status === "on-leave" || e.status === "remote"
  ).length;

  const headcountOverTime = useMemo(() => {
    const baseTotal = totalEmployees;
    return monthlyWindow.map((m, i) => {
      const factor = 0.88 + (0.12 * i) / 11;
      return {
        month: m.label,
        headcount: Math.max(1, Math.round(baseTotal * factor)),
      };
    });
  }, [totalEmployees]);

  const employeesPerDept = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedEmployees.forEach((e) => {
      counts[e.department] = (counts[e.department] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);
  }, [scopedEmployees]);

  const visibleDepts = useMemo(() => {
    const set = new Set(scopedEmployees.map((e) => e.department));
    return DEPT_LIST.filter((d) => set.has(d));
  }, [scopedEmployees]);

  const scopedNewHires = useMemo(() => {
    const factors: Record<string, number> = {};
    DEPT_LIST.forEach((dept) => {
      const total = employees.filter((e) => e.department === dept).length;
      const scoped = scopedEmployees.filter((e) => e.department === dept).length;
      factors[dept] = total > 0 ? scoped / total : 0;
    });
    return monthlyNewHires.map((m) => {
      const row: Record<string, string | number> = { month: m.month };
      DEPT_LIST.forEach((dept) => {
        const v = (m as unknown as Record<string, number>)[dept] ?? 0;
        row[dept] = Math.round(v * factors[dept]);
      });
      return row;
    });
  }, [scopedEmployees]);

  const totalPayroll = useMemo(
    () => scopedEmployees.reduce((sum, e) => sum + e.salary, 0),
    [scopedEmployees]
  );

  const wagesPerDept = useMemo(() => {
    const sums: Record<string, number> = {};
    scopedEmployees.forEach((e) => {
      sums[e.department] = (sums[e.department] ?? 0) + e.salary;
    });
    return Object.entries(sums)
      .map(([dept, amount]) => ({ dept, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedEmployees]);

  // ============================================================
  // LEAVE SECTION DATA
  // ============================================================
  const pendingApprovalsCount = scopedLeaveRequests.filter(
    (r) => r.status === "Pending"
  ).length;
  const visiblePending = scopedLeaveRequests.filter(
    (r) => r.status === "Pending"
  );
  const myRequests = scopedLeaveRequests.filter(
    (r) => r.employeeId === currentUser.id
  );
  const myPendingLeaves = myRequests.filter(
    (r) => r.status === "Pending"
  ).length;
  const myApprovedLeaves = myRequests.filter(
    (r) => r.status === "Approved"
  ).length;

  const scopedLeavesByType = useMemo(() => {
    const ratio =
      employees.length > 0 ? scopedEmployees.length / employees.length : 0;
    return monthlyLeavesByType.map((m) => ({
      month: m.month,
      Annual: Math.round((m.Annual ?? 0) * ratio),
      Sick: Math.round((m.Sick ?? 0) * ratio),
      Personal: Math.round((m.Personal ?? 0) * ratio),
    }));
  }, [scopedEmployees]);

  const leaveDaysPerDept = useMemo(() => {
    const sums: Record<string, number> = {};
    scopedLeaveRequests.forEach((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      if (!emp) return;
      sums[emp.department] = (sums[emp.department] ?? 0) + r.daysCount;
    });
    return Object.entries(sums)
      .map(([dept, days]) => ({ dept, days }))
      .sort((a, b) => b.days - a.days);
  }, [scopedLeaveRequests]);

  // ============================================================
  // SKILLS SECTION DATA
  // ============================================================
  const allScopedLevels = useMemo(() => {
    const levels: number[] = [];
    scopedEmployees.forEach((e) => {
      e.skills?.forEach((s) => levels.push(s.level));
    });
    return levels;
  }, [scopedEmployees]);

  const avgSkillScore = allScopedLevels.length
    ? Number(
        (
          allScopedLevels.reduce((a, b) => a + b, 0) / allScopedLevels.length
        ).toFixed(2)
      )
    : 0;

  const skillsTracked = useMemo(() => {
    const set = new Set<string>();
    scopedEmployees.forEach((e) =>
      e.skills?.forEach((s) => set.add(s.skill))
    );
    return set.size;
  }, [scopedEmployees]);

  const topSkill = useMemo(() => {
    const map: Record<string, number[]> = {};
    scopedEmployees.forEach((e) => {
      e.skills?.forEach((s) => {
        if (!map[s.skill]) map[s.skill] = [];
        map[s.skill].push(s.level);
      });
    });
    let best = { skill: "—", avg: 0 };
    Object.entries(map).forEach(([skill, levels]) => {
      const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
      if (avg > best.avg) best = { skill, avg };
    });
    return best;
  }, [scopedEmployees]);

  // Radar skills set
  const skillsForRadar = useMemo(() => {
    if (level === "dept") {
      const dept = org.departments.find((d) => d.id === unitId);
      if (dept && departmentSkills[dept.name]) return departmentSkills[dept.name];
    }
    const set = new Set<string>();
    scopedEmployees.forEach((e) => {
      e.skills?.forEach((s) => set.add(s.skill));
    });
    return Array.from(set).slice(0, 8);
  }, [level, unitId, org, scopedEmployees]);

  const radarData = useMemo(() => {
    return skillsForRadar.map((skillName) => {
      const levels = scopedEmployees
        .map((e) => e.skills?.find((s) => s.skill === skillName)?.level)
        .filter((l): l is number => typeof l === "number");
      const avg = levels.length
        ? Number((levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2))
        : 0;
      return { skill: skillName, level: avg };
    });
  }, [skillsForRadar, scopedEmployees]);

  // Skill rankings: peer groups inside the active scope
  // Global → BUs, BU → departments, Department → teams, Team → individuals.
  const skillRankings = useMemo(() => {
    type Bucket = { group: string; employees: typeof employees };
    const buckets: Bucket[] = [];

    if (level === "global") {
      org.businessUnits.forEach((bu) => {
        const deptNames = new Set(
          org.departments.filter((d) => d.buId === bu.id).map((d) => d.name)
        );
        const emps = employees.filter(
          (e) => e.buId === bu.id || deptNames.has(e.department)
        );
        if (emps.length > 0) buckets.push({ group: bu.name, employees: emps });
      });
    } else if (level === "bu") {
      const deptsInBu = org.departments.filter((d) => d.buId === unitId);
      deptsInBu.forEach((dept) => {
        const emps = scopedEmployees.filter((e) => e.department === dept.name);
        if (emps.length > 0)
          buckets.push({ group: dept.name, employees: emps });
      });
    } else if (level === "dept") {
      const teamsInDept = org.teams.filter((t) => t.departmentId === unitId);
      teamsInDept.forEach((team) => {
        const emps = scopedEmployees.filter(
          (e) => employeeExtras[e.id]?.team === team.name
        );
        if (emps.length > 0)
          buckets.push({ group: team.name, employees: emps });
      });
    } else {
      // team — show individuals
      scopedEmployees.forEach((e) => {
        buckets.push({ group: e.name, employees: [e] });
      });
    }

    return buckets
      .map((b) => {
        const levels: number[] = [];
        b.employees.forEach((e) =>
          e.skills?.forEach((s) => levels.push(s.level))
        );
        const avg = levels.length
          ? Number(
              (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)
            )
          : 0;
        return { group: b.group, avg };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [level, unitId, org, scopedEmployees]);

  const rankingPeerLabel = useMemo(() => {
    if (level === "global") return "business unit";
    if (level === "bu") return "department";
    if (level === "dept") return "team";
    return "person";
  }, [level]);

  // ============================================================
  // SKILLS GAP DATA
  // ============================================================
  const [gapData, setGapData] = useState<SkillsGapResult[]>([]);
  const [gapLoading, setGapLoading] = useState(false);

  useEffect(() => {
    if (tab !== "skills") return;
    setGapLoading(true);
    const ids = scopedEmployees.map((e) => String(e.id));
    Promise.allSettled(ids.map((id) => getSkillsGap(id)))
      .then((results) => {
        const settled: SkillsGapResult[] = [];
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value) settled.push(r.value);
        });
        setGapData(settled);
      })
      .finally(() => setGapLoading(false));
  }, [tab, scopedEmployees]);

  const gapInsights = useMemo(() => {
    if (gapData.length === 0) return null;

    let met = 0, exceeds = 0, partial = 0, missing = 0;
    let fullyReady = 0;
    const skillExceedsMap: Record<string, number> = {};
    const skillGapMap: Record<string, number> = {};

    gapData.forEach((emp) => {
      let empReady = true;
      emp.items.forEach((item) => {
        if (item.status === "MET")     { met++;     }
        if (item.status === "EXCEEDS") { exceeds++;  skillExceedsMap[item.skill.name] = (skillExceedsMap[item.skill.name] ?? 0) + 1; }
        if (item.status === "PARTIAL") { partial++;  skillGapMap[item.skill.name] = (skillGapMap[item.skill.name] ?? 0) + 1; empReady = false; }
        if (item.status === "MISSING") { missing++;  skillGapMap[item.skill.name] = (skillGapMap[item.skill.name] ?? 0) + 1; if (item.requirementLevel === "MANDATORY") empReady = false; }
      });
      if (empReady) fullyReady++;
    });

    const total = met + exceeds + partial + missing;
    const avgReadiness = total > 0 ? Math.round(((met + exceeds) / total) * 100) : 100;

    const topExceeded = Object.entries(skillExceedsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([skill, count]) => ({ skill, count }));

    const topGaps = Object.entries(skillGapMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([skill, count]) => ({ skill, count }));

    const hasGaps = partial + missing > 0;

    return { met, exceeds, partial, missing, total, fullyReady, avgReadiness, topExceeded, topGaps, hasGaps };
  }, [gapData]);

  const skillEvolution = useMemo(() => {
    const dateMap = new Map<string, string>();
    scopedEmployees.forEach((e) => {
      const hist = skillHistory[e.id] ?? [];
      hist.forEach((snap) => dateMap.set(snap.date, snap.label));
    });
    const sortedDates = Array.from(dateMap.keys()).sort();

    return sortedDates.map((date) => {
      const label = dateMap.get(date)!;
      const allLevels: number[] = [];
      scopedEmployees.forEach((e) => {
        const hist = skillHistory[e.id] ?? [];
        const snap = hist.find((s) => s.date === date);
        if (snap) {
          Object.values(snap.skills).forEach((v) => allLevels.push(v));
        }
      });
      const avg = allLevels.length
        ? Number(
            (allLevels.reduce((a, b) => a + b, 0) / allLevels.length).toFixed(2)
          )
        : 0;
      return { quarter: label, avg };
    });
  }, [scopedEmployees]);

  // ============================================================
  // PROMOTIONS SECTION DATA
  // ============================================================
  const [allPromos, setAllPromos] = useState<PromotionRequest[]>([]);
  useEffect(() => {
    if (tab !== "promotions") return;
    setAllPromos(getPromotionRequests());
  }, [tab]);

  const [promoYear, setPromoYear] = useState("all");
  const [promoBuId, setPromoBuId] = useState("all");
  const [promoDeptName, setPromoDeptName] = useState("all");
  const [promoTeamName, setPromoTeamName] = useState("all");

  useEffect(() => {
    setPromoDeptName("all");
    setPromoTeamName("all");
  }, [promoBuId]);

  useEffect(() => {
    setPromoTeamName("all");
  }, [promoDeptName]);

  const enrichedPromos = useMemo(() => {
    return allPromos.map((p) => {
      const emp = employees.find((e) => e.id === p.employeeId);
      return {
        ...p,
        department: emp?.department ?? "",
        buId: emp?.buId ?? "",
        teamName: employeeExtras[p.employeeId]?.team ?? "",
        year: p.submittedAt.slice(0, 4),
      };
    });
  }, [allPromos]);

  const promoYearOptions = useMemo(() => {
    const years = new Set(enrichedPromos.map((p) => p.year));
    return Array.from(years).sort().reverse();
  }, [enrichedPromos]);

  const promoBuOptions = useMemo(() => {
    const ids = new Set(enrichedPromos.map((p) => p.buId).filter(Boolean));
    return org.businessUnits.filter((bu) => ids.has(bu.id));
  }, [enrichedPromos, org.businessUnits]);

  const promoDeptOptions = useMemo(() => {
    const base =
      promoBuId === "all"
        ? enrichedPromos
        : enrichedPromos.filter((p) => p.buId === promoBuId);
    return Array.from(
      new Set(base.map((p) => p.department).filter(Boolean))
    ).sort();
  }, [enrichedPromos, promoBuId]);

  const promoTeamOptions = useMemo(() => {
    let base = enrichedPromos;
    if (promoBuId !== "all") base = base.filter((p) => p.buId === promoBuId);
    if (promoDeptName !== "all")
      base = base.filter((p) => p.department === promoDeptName);
    return Array.from(
      new Set(base.map((p) => p.teamName).filter(Boolean))
    ).sort();
  }, [enrichedPromos, promoBuId, promoDeptName]);

  const filteredPromos = useMemo(() => {
    return enrichedPromos
      .filter((p) => promoYear === "all" || p.year === promoYear)
      .filter((p) => promoBuId === "all" || p.buId === promoBuId)
      .filter((p) => promoDeptName === "all" || p.department === promoDeptName)
      .filter((p) => promoTeamName === "all" || p.teamName === promoTeamName);
  }, [enrichedPromos, promoYear, promoBuId, promoDeptName, promoTeamName]);

  const promoStats = useMemo(() => {
    const total = filteredPromos.length;
    const avgLiftPct =
      total > 0
        ? Math.round(
            (filteredPromos.reduce((s, p) => s + p.salaryDeltaPct, 0) /
              total) *
              10
          ) / 10
        : 0;
    const totalCost = filteredPromos.reduce((s, p) => s + p.salaryDelta, 0);
    const pending = filteredPromos.filter((p) => p.status === "Pending").length;
    return { total, avgLiftPct, totalCost, pending };
  }, [filteredPromos]);

  const promoByDept = useMemo(() => {
    const map: Record<string, { count: number; totalPct: number }> = {};
    filteredPromos.forEach((p) => {
      const d = p.department || "Other";
      if (!map[d]) map[d] = { count: 0, totalPct: 0 };
      map[d].count++;
      map[d].totalPct += p.salaryDeltaPct;
    });
    return Object.entries(map)
      .map(([dept, { count, totalPct }]) => ({
        dept,
        count,
        avgLift: Math.round((totalPct / count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredPromos]);

  // ============================================================
  // ENGAGEMENT SECTION DATA — derived from scopedEmployees (canonical source)
  // ============================================================
  const [allReviews] = usePerformanceReviews();

  const scopedEmployeeIds = useMemo(
    () => new Set(scopedEmployees.map((e) => e.id)),
    [scopedEmployees]
  );

  const engagementStats = useMemo(
    () => computeEngagementAggregates(scopedEmployeeIds, allReviews),
    [scopedEmployeeIds, allReviews]
  );

  const engagementBreakdown = useMemo(
    () => computeEngagementBreakdown(level, scopedEmployees, allReviews, org, unitId),
    [level, scopedEmployees, allReviews, org, unitId]
  );

  const engagementTrend = useMemo(
    () => computeEngagementTrend(scopedEmployeeIds, allReviews),
    [scopedEmployeeIds, allReviews]
  );

  const engagementBreakdownKeys = [
    "😊 Env Satisfaction",
    "💼 Job Satisfaction",
    "🤝 Relationship",
    "⚖️ Work-Life",
    "📚 Training",
  ] as const;

  const ENGAGEMENT_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
          data-testid="heading-dashboard"
        >
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {currentUser.name.split(" ")[0]} — viewing{" "}
          {scopeLabel}
        </p>
      </div>

      {/* Sticky scope filter + tab bar */}
      <div
        className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-gray-200 dark:border-gray-800 space-y-2"
        data-testid="dashboard-controls"
      >
        <DashboardScopeFilter
          level={level}
          unitId={unitId}
          unitOptions={unitOptions}
          onChange={setScope}
        />
        <div
          className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto w-fit max-w-full"
          data-testid="dashboard-tab-bar"
        >
          {TAB_DEFS.map(({ value, label, icon: Icon, emoji }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === value
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
              data-testid={`dashboard-tab-${value}`}
            >
              {emoji ? (
                <span className="text-sm leading-none">{emoji}</span>
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===========================================================
          TAB PANELS — only one section visible at a time
          =========================================================== */}
      <div
        key={tab}
        className="animate-in fade-in-50 duration-200"
        data-testid={`dashboard-panel-${tab}`}
      >
        {tab === "overview" && (
          <OverviewPanel
            scopeLabel={scopeLabel}
            totalEmployees={totalEmployees}
            totalPayroll={totalPayroll}
            pendingApprovalsCount={pendingApprovalsCount}
            avgSkillScore={avgSkillScore}
            headcountOverTime={headcountOverTime}
            scopedLeavesByType={scopedLeavesByType}
            skillEvolution={skillEvolution}
            wagesPerDept={wagesPerDept}
            engagementStats={engagementStats}
            engagementTrend={engagementTrend}
          />
        )}

        {tab === "employees" && (
          <section className="space-y-4" data-testid="section-employees">
            <SectionHeader
              icon={Users}
              title="Employees"
              subtitle="Headcount, growth, and distribution"
              iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Total Employees"
                value={totalEmployees}
                sub={`Across ${scopeLabel}`}
                icon={Users}
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              />
              <StatCard
                title="Active Employees"
                value={activeEmployees}
                sub="Currently working"
                icon={UserCheck}
                color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              />
              <StatCard
                title="On Leave / Remote"
                value={onLeaveOrRemote}
                sub="Away or off-site"
                icon={Plane}
                color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Headcount over time
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Last 12 months — {scopeLabel}
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={headcountOverTime}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="headcount"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Employees per department
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Distribution across teams
                  </p>
                </CardHeader>
                <CardContent>
                  {employeesPerDept.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No data in scope
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={employeesPerDept}
                        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="dept"
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          allowDecimals={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="count"
                          radius={[6, 6, 0, 0]}
                          fill="#3b82f6"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  New hires by department
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Monthly hires across the last 12 months
                </p>
              </CardHeader>
              <CardContent>
                {visibleDepts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No hire data in scope
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={scopedNewHires}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                      {visibleDepts.map((dept) => (
                        <Bar
                          key={dept}
                          dataKey={dept}
                          stackId="hires"
                          fill={DEPT_COLORS[dept]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {tab === "leave" && (
          <section className="space-y-4" data-testid="section-leave">
            <SectionHeader
              icon={CalendarDays}
              title="Leave"
              subtitle="Time off, approvals, and trends"
              iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Pending Approvals"
                value={pendingApprovalsCount}
                sub="Leave requests awaiting action"
                icon={Clock}
                color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              />
              <StatCard
                title="My Pending Leaves"
                value={myPendingLeaves}
                sub="Your submitted requests"
                icon={CalendarX}
                color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
              />
              <StatCard
                title="My Approved Leaves"
                value={myApprovedLeaves}
                sub="Approved this year"
                icon={CalendarCheck}
                color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Leave days per department
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Total days in current requests
                  </p>
                </CardHeader>
                <CardContent>
                  {leaveDaysPerDept.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No leave data in scope
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={leaveDaysPerDept}
                        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="dept"
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          allowDecimals={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="days"
                          radius={[6, 6, 0, 0]}
                          fill="#f97316"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Leave requests over time
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    By leave type, last 12 months
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={scopedLeavesByType}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="circle"
                      />
                      {(["Annual", "Sick", "Personal"] as const).map((type) => (
                        <Line
                          key={type}
                          type="monotone"
                          dataKey={type}
                          stroke={LEAVE_COLORS[type]}
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    My Recent Requests
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {myRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No recent requests
                    </p>
                  ) : (
                    myRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        data-testid={`my-request-${req.id}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {req.type} Leave
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.startDate} → {req.endDate} · {req.daysCount}d
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(req.status)}`}
                        >
                          {req.status}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Pending Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {visiblePending.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No pending approvals
                    </p>
                  ) : (
                    visiblePending.map((req) => {
                      const emp = employees.find(
                        (e) => e.id === req.employeeId
                      );
                      const initials = req.employeeName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase();
                      return (
                        <div
                          key={req.id}
                          className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                          data-testid={`pending-request-${req.id}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 flex-shrink-0">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {req.employeeName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.type} · {req.daysCount}d ·{" "}
                              {emp?.department ?? "—"}
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 font-medium transition-colors">
                              Approve
                            </button>
                            <button className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 font-medium transition-colors">
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {tab === "skills" && (
          <section className="space-y-4" data-testid="section-skills">
            <SectionHeader
              icon={Sparkles}
              title="Skills"
              subtitle="Proficiency, distribution, and growth"
              iconColor="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            />

            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                title="Avg Skill Score"
                value={`${avgSkillScore} / 5`}
                sub={`Across ${scopedEmployees.length} people`}
                icon={Sparkles}
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
              />
              <StatCard
                title="Skills Tracked"
                value={skillsTracked}
                sub="Unique skills in scope"
                icon={Layers}
                color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
              />
              <StatCard
                title="Top Skill"
                value={topSkill.skill}
                sub={topSkill.avg ? `Avg ${topSkill.avg.toFixed(2)} / 5` : "—"}
                icon={Trophy}
                color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Average proficiency
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Per skill — {scopeLabel}
                  </p>
                </CardHeader>
                <CardContent>
                  {radarData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No skill data in scope
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart
                        data={radarData}
                        margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                      >
                        <PolarGrid
                          stroke="currentColor"
                          className="text-gray-200 dark:text-gray-700"
                        />
                        <PolarAngleAxis
                          dataKey="skill"
                          tick={{ fontSize: 11, fill: "currentColor" }}
                          className="text-gray-500 dark:text-gray-400"
                        />
                        <PolarRadiusAxis
                          domain={[0, 5]}
                          tick={false}
                          axisLine={false}
                        />
                        <Radar
                          name="Avg Level"
                          dataKey="level"
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                          fillOpacity={0.22}
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value}/5`,
                            "Avg Level",
                          ]}
                          contentStyle={tooltipStyle}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Skill rankings
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Average score by {rankingPeerLabel}
                  </p>
                </CardHeader>
                <CardContent>
                  {skillRankings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No rankings available
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={skillRankings}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={[0, 5]}
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                        />
                        <YAxis
                          dataKey="group"
                          type="category"
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          width={140}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number) => [`${v} / 5`, "Avg score"]}
                        />
                        <Bar
                          dataKey="avg"
                          radius={[0, 6, 6, 0]}
                          fill="#8b5cf6"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Skill score evolution
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Quarterly trend — {scopeLabel}
                </p>
              </CardHeader>
              <CardContent>
                {skillEvolution.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No history available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={skillEvolution}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="quarter"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <YAxis
                        domain={[0, 5]}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [`${v} / 5`, "Avg score"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Skills Gap Insights ─────────────────────────────── */}
            <div className="flex items-center gap-3 pt-2 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Skills Gap Insights</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Role readiness across {scopedEmployees.length} people in scope</p>
              </div>
            </div>

            {gapLoading ? (
              <div className="text-center py-10 text-sm text-muted-foreground animate-pulse">
                Loading gap data…
              </div>
            ) : !gapInsights ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No position assignments found for employees in scope.
              </div>
            ) : (
              <>
                {/* Stat row */}
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    title="Role-Ready Employees"
                    value={`${gapInsights.fullyReady} / ${gapData.length}`}
                    sub="All mandatory skills met or exceeded"
                    icon={ShieldCheck}
                    color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  />
                  <StatCard
                    title="Avg Readiness"
                    value={`${gapInsights.avgReadiness}%`}
                    sub="Required skills met or exceeded"
                    icon={TrendingUp}
                    color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                  />
                  <StatCard
                    title="Skills Exceeded"
                    value={gapInsights.exceeds}
                    sub={`Across ${gapData.length} employees vs. their role`}
                    icon={Star}
                    color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                  />
                </div>

                {/* Charts row */}
                <div className="grid gap-4 lg:grid-cols-2">

                  {/* Coverage breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Coverage breakdown
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Total skill assessments by status — {scopeLabel}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[
                            { name: "Met",     value: gapInsights.met,     fill: "#22c55e" },
                            { name: "Exceeds", value: gapInsights.exceeds,  fill: "#4f46e5" },
                            { name: "Partial", value: gapInsights.partial,  fill: "#f59e0b" },
                            { name: "Missing", value: gapInsights.missing,  fill: "#ef4444" },
                          ]}
                          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: number, _n: string, props: { payload?: { name: string } }) => [v, props.payload?.name ?? ""]}
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {[
                              { name: "Met",     fill: "#22c55e" },
                              { name: "Exceeds", fill: "#4f46e5" },
                              { name: "Partial", fill: "#f59e0b" },
                              { name: "Missing", fill: "#ef4444" },
                            ].map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Top gaps or top exceeded */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {gapInsights.hasGaps ? "Most common skill gaps" : "Top skills exceeded"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {gapInsights.hasGaps
                          ? "Skills most frequently partial or missing across role requirements"
                          : "Skills where employees go beyond their role requirements"}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {(gapInsights.hasGaps ? gapInsights.topGaps : gapInsights.topExceeded).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-12 text-center">No data</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={gapInsights.hasGaps ? gapInsights.topGaps : gapInsights.topExceeded}
                            layout="vertical"
                            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                            <YAxis
                              dataKey="skill"
                              type="category"
                              tick={{ fontSize: 11, fill: "#6b7280" }}
                              width={120}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(v: number) => [v, gapInsights.hasGaps ? "Employees with gap" : "Employees exceeding"]}
                            />
                            <Bar
                              dataKey="count"
                              fill={gapInsights.hasGaps ? "#f59e0b" : "#4f46e5"}
                              radius={[0, 6, 6, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "engagement" && (
          <section className="space-y-4" data-testid="section-engagement">
            <SectionHeader
              icon={Star}
              title="Engagement 😊"
              subtitle={`Satisfaction & training from performance reviews — ${scopeLabel}`}
              iconColor="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
            />

            {!engagementStats ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="text-5xl mb-4">😊</div>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
                    No review data for this scope
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add performance reviews for employees in {scopeLabel} to see
                    engagement metrics here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        😊 Avg Environment Satisfaction
                      </CardTitle>
                      <div className="p-1.5 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {engagementStats.environmentSatisfaction.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Avg across {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        💼 Avg Job Satisfaction
                      </CardTitle>
                      <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {engagementStats.jobSatisfaction.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Avg across {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        🤝 Avg Relationship Satisfaction
                      </CardTitle>
                      <div className="p-1.5 rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {engagementStats.relationshipSatisfaction.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Avg across {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        ⚖️ Avg Work-Life Balance
                      </CardTitle>
                      <div className="p-1.5 rounded-md bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {engagementStats.workLifeBalance.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Avg across {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        📚 Training Sessions Taken
                      </CardTitle>
                      <div className="p-1.5 rounded-md bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {engagementStats.totalTrainingSessions}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Total · avg {engagementStats.avgTrainingPerReview}/person across {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Overall engagement snapshot for this scope */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Engagement snapshot
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Avg score per dimension — {scopeLabel} · {engagementStats.reviewCount} review{engagementStats.reviewCount !== 1 ? "s" : ""}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart
                          data={[
                            { dimension: "😊 Environment", score: engagementStats.environmentSatisfaction, isTraining: false },
                            { dimension: "💼 Job", score: engagementStats.jobSatisfaction, isTraining: false },
                            { dimension: "🤝 Relationship", score: engagementStats.relationshipSatisfaction, isTraining: false },
                            { dimension: "⚖️ Work-Life", score: engagementStats.workLifeBalance, isTraining: false },
                            { dimension: "📚 Avg Training", score: engagementStats.avgTrainingPerReview, isTraining: true },
                          ]}
                          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="dimension" tick={{ fontSize: 10, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: number, _: string, props: { payload?: { isTraining?: boolean } }) =>
                              props.payload?.isTraining
                                ? [`${v} sessions`, "Avg training"]
                                : [`${v} / 5`, "Avg score"]
                            }
                          />
                          <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                            {[
                              { fill: "#3b82f6" },
                              { fill: "#10b981" },
                              { fill: "#f59e0b" },
                              { fill: "#8b5cf6" },
                              { fill: "#06b6d4" },
                            ].map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Breakdown by child unit */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Engagement by{" "}
                        {level === "global"
                          ? "business unit"
                          : level === "bu"
                          ? "department"
                          : "team"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {level === "team"
                          ? "Team is the most granular scope"
                          : "All five dimensions grouped by child unit"}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {level === "team" ? (
                        <p className="text-sm text-muted-foreground py-12 text-center">
                          No child unit breakdown — team is the lowest level scope. Use the snapshot chart on the left to compare dimensions.
                        </p>
                      ) : engagementBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-12 text-center">
                          No breakdown data available for this scope
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={engagementBreakdown}
                            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis
                              dataKey="group"
                              tick={{ fontSize: 10, fill: "#6b7280" }}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(v: number, name: string) =>
                                name === "📚 Training"
                                  ? [`${v} avg sessions`, name]
                                  : [`${v} / 5`, name]
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                            {engagementBreakdownKeys.map((key, i) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                fill={ENGAGEMENT_COLORS[i]}
                                radius={[3, 3, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Training sessions breakdown */}
                {engagementBreakdown.length > 1 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        📚 Avg Training Sessions by{" "}
                        {level === "global"
                          ? "business unit"
                          : level === "bu"
                          ? "department"
                          : "team"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Average training opportunities taken per review
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={engagementBreakdown}
                          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: number) => [v, "Avg sessions"]}
                          />
                          <Bar
                            dataKey="📚 Training"
                            fill={ENGAGEMENT_COLORS[4]}
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </section>
        )}

        {tab === "promotions" && (
          <section className="space-y-4" data-testid="section-promotions">
            <SectionHeader
              icon={Trophy}
              title="Promotions"
              subtitle="Salary changes and budget impact across simulation requests"
              iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            />

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
                Filter:
              </span>
              <Select value={promoYear} onValueChange={setPromoYear}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {promoYearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={promoBuId} onValueChange={setPromoBuId}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Business Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All BUs</SelectItem>
                  {promoBuOptions.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={promoDeptName}
                onValueChange={setPromoDeptName}
                disabled={promoDeptOptions.length === 0}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All depts</SelectItem>
                  {promoDeptOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={promoTeamName}
                onValueChange={setPromoTeamName}
                disabled={promoTeamOptions.length === 0}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {promoTeamOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(promoYear !== "all" ||
                promoBuId !== "all" ||
                promoDeptName !== "all" ||
                promoTeamName !== "all") && (
                <button
                  onClick={() => {
                    setPromoYear("all");
                    setPromoBuId("all");
                    setPromoDeptName("all");
                    setPromoTeamName("all");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Requests"
                value={promoStats.total}
                sub="Promotion simulations"
                icon={Trophy}
                color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              />
              <StatCard
                title="Avg Salary Lift"
                value={`+${promoStats.avgLiftPct}%`}
                sub="Across filtered requests"
                icon={TrendingUp}
                color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              />
              <StatCard
                title="Total Budget Impact"
                value={`$${(promoStats.totalCost / 1000).toFixed(0)}k`}
                sub="Combined salary delta"
                icon={DollarSign}
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              />
              <StatCard
                title="Pending"
                value={promoStats.pending}
                sub="Awaiting decision"
                icon={Clock}
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
              />
            </div>

            {filteredPromos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No promotion requests match the current filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Charts */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Promotions by Department
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Number of requests per department
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={promoByDept}
                          layout="vertical"
                          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="dept"
                            width={90}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: number) => [v, "Requests"]}
                          />
                          <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Avg Salary Lift % by Department
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Average raise percentage per department
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={promoByDept}
                          layout="vertical"
                          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="dept"
                            width={90}
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v: number) => [`${v}%`, "Avg lift"]}
                          />
                          <Bar dataKey="avgLift" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent requests list */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Promotion Requests
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {filteredPromos.length} request
                      {filteredPromos.length !== 1 ? "s" : ""} — sorted by date
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredPromos
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.submittedAt).getTime() -
                            new Date(a.submittedAt).getTime()
                        )
                        .map((p) => {
                          const initials = p.employeeName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2);
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-4 px-5 py-3"
                              data-testid={`promo-row-${p.id}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-xs font-semibold text-amber-700 dark:text-amber-300 flex-shrink-0">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {p.employeeName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {p.currentRole}{" "}
                                  <span className="text-gray-400 dark:text-gray-500">
                                    →
                                  </span>{" "}
                                  {p.newRole}
                                </p>
                              </div>
                              <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                  +{p.salaryDeltaPct.toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  +${(p.salaryDelta / 1000).toFixed(0)}k/yr
                                </span>
                              </div>
                              <div className="hidden md:flex flex-col items-end gap-0.5 text-right flex-shrink-0 min-w-[80px]">
                                <span className="text-xs text-muted-foreground">
                                  {p.department || "—"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(p.submittedAt).toLocaleDateString(
                                    "en-US",
                                    { month: "short", year: "numeric" }
                                  )}
                                </span>
                              </div>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 flex-shrink-0">
                                {p.status}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW PANEL — at-a-glance summary, one KPI + one chart per area
// ============================================================
function OverviewPanel({
  scopeLabel,
  totalEmployees,
  totalPayroll,
  pendingApprovalsCount,
  avgSkillScore,
  headcountOverTime,
  scopedLeavesByType,
  skillEvolution,
  wagesPerDept,
  engagementStats,
  engagementTrend,
}: {
  scopeLabel: string;
  totalEmployees: number;
  totalPayroll: number;
  pendingApprovalsCount: number;
  avgSkillScore: number;
  headcountOverTime: { month: string; headcount: number }[];
  scopedLeavesByType: { month: string; Annual: number; Sick: number; Personal: number }[];
  skillEvolution: { quarter: string; avg: number }[];
  wagesPerDept: { dept: string; amount: number }[];
  engagementStats: EngagementAggregates | null;
  engagementTrend: { quarter: string; avg: number }[];
}) {
  const avgEngagement = engagementStats
    ? Math.round(
        ((engagementStats.environmentSatisfaction +
          engagementStats.jobSatisfaction +
          engagementStats.relationshipSatisfaction +
          engagementStats.workLifeBalance) /
          4) *
          100
      ) / 100
    : null;
  return (
    <section className="space-y-4" data-testid="section-overview">
      <SectionHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle={`At-a-glance summary — ${scopeLabel}`}
        iconColor="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Headcount"
          value={totalEmployees}
          sub={`In ${scopeLabel}`}
          icon={Users}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          title="Payroll Cost"
          value={`$${(totalPayroll / 1000000).toFixed(2)}M`}
          sub="Annual gross"
          icon={Wallet}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          title="Pending Leaves"
          value={pendingApprovalsCount}
          sub="Awaiting approval"
          icon={Clock}
          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          title="Avg Skill Score"
          value={`${avgSkillScore} / 5`}
          sub="Across all skills"
          icon={Sparkles}
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
        <StatCard
          title="Avg Engagement"
          value={avgEngagement !== null ? `${avgEngagement} / 5` : "—"}
          sub="Mean of 4 satisfaction dimensions"
          icon={Star}
          color="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              Headcount trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">Last 12 months</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={headcountOverTime}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="headcount"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              Wages per department
            </CardTitle>
            <p className="text-xs text-muted-foreground">Annual gross salary</p>
          </CardHeader>
          <CardContent>
            {wagesPerDept.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No data in scope
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={wagesPerDept}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dept"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [
                      `$${v.toLocaleString()}`,
                      "Wages",
                    ]}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
              Leave requests trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">By type, last 12 months</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={scopedLeavesByType}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                {(["Annual", "Sick", "Personal"] as const).map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={LEAVE_COLORS[type]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
              Skill score trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">Quarterly evolution</p>
          </CardHeader>
          <CardContent>
            {skillEvolution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No history available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={skillEvolution}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} / 5`, "Avg score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-pink-500" />
              Engagement trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mean of 4 satisfaction dimensions · quarterly · {scopeLabel}
            </p>
          </CardHeader>
          <CardContent>
            {engagementTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No review data in scope yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={engagementTrend}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} / 5`, "Avg engagement"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#ec4899", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
