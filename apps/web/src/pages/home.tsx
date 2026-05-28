import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  GitFork,
  ClipboardList,
  CheckCircle2,
  UserCheck,
  Briefcase,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { getEmployees, getEmployee, getMyLeaveRequests } from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import { LeaveRequestSummary } from "@/components/leave-request-summary";
import { getRoleTier, roleLabel, type RoleTier } from "@/lib/auth";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const quickLinks = [
  {
    title: "Dashboard",
    description: "Analytics, headcount trends, and payroll overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "#2563eb",
    tiers: ["hr_admin", "dept_manager", "team_lead"] as RoleTier[],
  },
  {
    title: "Employees",
    description: "Browse the employee directory and org context",
    href: "/employees",
    icon: Users,
    color: "#7c3aed",
    tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[],
  },
  {
    title: "Leave Requests",
    description: "Review and approve pending time-off requests",
    href: "/leaves",
    icon: CalendarDays,
    color: "#d97706",
    tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[],
  },
  {
    title: "Org Chart",
    description: "Visual hierarchy by department, team, and people",
    href: "/org-chart",
    icon: GitFork,
    color: "#059669",
    tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[],
  },
  {
    title: "Performance Reviews",
    description: "Submit and track performance review work",
    href: "/performance-reviews",
    icon: ClipboardList,
    color: "#0ea5e9",
    tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[],
  },
  {
    title: "Simulation",
    description: "Model promotion budget impact in your scope",
    href: "/simulation",
    icon: Sparkles,
    color: "#c026d3",
    tiers: ["hr_admin", "dept_manager", "team_lead"] as RoleTier[],
  },
];

export default function Home() {
  const { user } = useAuth();
  const greeting = getGreeting();

  const { data: profile } = useQuery({
    queryKey: ["employee-profile", user?.employeeId],
    queryFn: () => getEmployee(user!.employeeId!),
    enabled: !!user?.employeeId,
  });

  const { data: totalResult } = useQuery({
    queryKey: ["employees-count", "total"],
    queryFn: () => getEmployees({ limit: 1 }),
  });

  const { data: activeResult } = useQuery({
    queryKey: ["employees-count", "ACTIVE"],
    queryFn: () => getEmployees({ status: "ACTIVE", limit: 1 }),
  });

  const { data: onLeaveResult } = useQuery({
    queryKey: ["employees-count", "ON_LEAVE"],
    queryFn: () => getEmployees({ status: "ON_LEAVE", limit: 1 }),
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["my-leave-requests", "PENDING"],
    queryFn: () => getMyLeaveRequests({ status: "PENDING" }),
  });

  const { data: approvedLeaves } = useQuery({
    queryKey: ["my-leave-requests", "APPROVED"],
    queryFn: () => getMyLeaveRequests({ status: "APPROVED" }),
  });

  const firstName = profile?.firstName ?? "…";
  const userRole = user ? roleLabel(user.roles) : "";
  const roleTier = user ? getRoleTier(user) : "employee";
  const department = profile?.department?.name ?? "";
  const visibleQuickLinks = quickLinks.filter((link) => link.tiers.includes(roleTier));

  const stats = [
    {
      label: "Total Employees",
      value: totalResult?.total ?? "—",
      icon: Users,
      color: "#2563eb",
    },
    {
      label: "Active Today",
      value: activeResult?.total ?? "—",
      icon: UserCheck,
      color: "#059669",
    },
    {
      label: "On Leave",
      value: onLeaveResult?.total ?? "—",
      icon: Briefcase,
      color: "#d97706",
    },
    {
      label: "Pending Approvals",
      value: pendingLeaves?.length ?? "—",
      icon: ClipboardList,
      color: "#7c3aed",
    },
  ];

  const recentlyApproved = (approvedLeaves ?? []).slice(0, 3);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Welcome header */}
      <div className="space-y-1" data-testid="home-welcome">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">
          {greeting}
        </p>
        <h1
          className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
          data-testid="home-greeting"
        >
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {userRole}{department ? ` · ${department}` : ""} ·{" "}
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="home-stats">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: s.color }} />
            <div className="pl-2.5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${s.color}1a` }}
                >
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="home-quick-links">
          {visibleQuickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className="relative overflow-hidden rounded-xl border bg-card p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                data-testid={`home-link-${link.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: link.color }} />
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
                  style={{ backgroundColor: `${link.color}1a` }}
                >
                  <link.icon className="w-4 h-4" style={{ color: link.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:underline underline-offset-2">
                    {link.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {link.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent approvals */}
      {recentlyApproved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
            Recently Approved Leave
          </h2>
          <div className="rounded-xl border bg-card shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
            {recentlyApproved.map((req) => {
              const empName = req.employee
                ? `${req.employee.firstName} ${req.employee.lastName}`
                : "Employee";
              const initials = empName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
              <div
                key={req.id}
                className="flex items-center justify-between px-4 py-3"
                data-testid={`home-leave-row-${req.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {empName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <LeaveRequestSummary request={req} />
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
