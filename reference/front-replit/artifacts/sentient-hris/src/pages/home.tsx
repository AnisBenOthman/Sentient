import { Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  GitFork,
  ClipboardList,
  CheckCircle2,
  UserCheck,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { currentUser, metrics, employees, leaveRequests } from "@/lib/mock-data";

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
    color: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/60",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
  },
  {
    title: "Employees",
    description: "Browse profiles, roles, and contact information",
    href: "/employees",
    icon: Users,
    color: "bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/60",
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-900/50",
  },
  {
    title: "Leave Requests",
    description: "Review and approve pending time-off requests",
    href: "/leaves",
    icon: CalendarDays,
    color: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/60",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
  },
  {
    title: "Org Chart",
    description: "Visual hierarchy by department, team, and people",
    href: "/org-chart",
    icon: GitFork,
    color: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
  },
];

export default function Home() {
  const greeting = getGreeting();
  const firstName = currentUser.name.split(" ")[0];

  const activeCount = employees.filter((e) => e.status === "active").length;
  const onLeaveCount = employees.filter((e) => e.status === "on-leave").length;
  const pendingLeaves = leaveRequests.filter((r) => r.status === "Pending").length;

  const stats = [
    {
      label: "Total Employees",
      value: metrics.totalHeadcount,
      icon: Users,
      iconColor: "text-blue-500 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Active Today",
      value: activeCount,
      icon: UserCheck,
      iconColor: "text-emerald-500 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "On Leave",
      value: onLeaveCount,
      icon: Briefcase,
      iconColor: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Pending Approvals",
      value: pendingLeaves,
      icon: ClipboardList,
      iconColor: "text-violet-500 dark:text-violet-400",
      iconBg: "bg-violet-50 dark:bg-violet-950/40",
    },
  ];

  const recentlyApproved = leaveRequests
    .filter((r) => r.status === "Approved")
    .slice(0, 3);

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
          {currentUser.role} · {currentUser.department} ·{" "}
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
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
              <s.icon className={`w-4 h-4 ${s.iconColor}`} />
            </div>
            <div>
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
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className={`border rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-all cursor-pointer group ${link.color}`}
                data-testid={`home-link-${link.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${link.iconBg}`}
                >
                  <link.icon className={`w-4 h-4 ${link.iconColor}`} />
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
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
            {recentlyApproved.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between px-4 py-3"
                data-testid={`home-leave-row-${req.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 flex-shrink-0">
                    {req.employeeName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {req.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.type} · {req.daysCount} day{req.daysCount !== 1 ? "s" : ""} ·{" "}
                      {req.startDate}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
