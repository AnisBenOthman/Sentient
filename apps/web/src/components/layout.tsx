import { Link, useLocation } from "wouter";
import {
  Home,
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  Brain,
  Menu,
  GitFork,
  Sun,
  Moon,
  Briefcase,
  Sparkles,
  ClipboardCheck,
  CalendarClock,
  UserRound,
  Target,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { getEmployee } from "@/lib/api/hr-core";
import { getRoleTier, roleTierLabel, type RoleTier } from "@/lib/auth";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

interface LayoutProps {
  children: React.ReactNode;
}

const ALL_MAIN_NAV = [
  { title: "Home",                href: "/home",                icon: Home,            tourId: "home-nav",          tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "My Profile",          href: "/profile",             icon: UserRound,       tourId: "profile-nav",       tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "Dashboard",           href: "/dashboard",           icon: LayoutDashboard, tourId: "dashboard-nav",     tiers: ["hr_admin", "dept_manager", "team_lead"]                as RoleTier[] },
  { title: "Employees",           href: "/employees",           icon: Users,           tourId: "employees-nav",     tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "Leaves",              href: "/leaves",              icon: CalendarDays,    tourId: "leaves-nav",        tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "Org Chart",           href: "/org-chart",           icon: GitFork,         tourId: "org-chart-nav",     tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "Performance Reviews", href: "/performance-reviews", icon: ClipboardCheck,  tourId: "performance-nav",   tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "My OKRs",             href: "/my-okrs",             icon: Target,          tourId: "my-okrs-nav",       tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "OKR Dashboard",       href: "/okr-dashboard",       icon: BarChart2,       tourId: "okr-dashboard-nav", tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] as RoleTier[] },
  { title: "OKR Management",      href: "/okr-cycle-management", icon: Target,         tourId: undefined,            tiers: ["dept_manager", "team_lead"] as RoleTier[] },
  { title: "Simulation",          href: "/simulation",          icon: Sparkles,        tourId: "simulation-nav",    tiers: ["hr_admin", "dept_manager", "team_lead"]              as RoleTier[] },
];

const ALL_ADMIN_NAV = [
  { title: "Positions",             href: "/positions",             icon: Briefcase,    tourId: "positions-nav",  tiers: ["hr_admin"] as RoleTier[] },
  { title: "Leave Management",      href: "/leave-management",      icon: CalendarClock, tourId: "leave-mgmt-nav", tiers: ["hr_admin"] as RoleTier[] },
  { title: "OKR Cycle Management",  href: "/okr-cycle-management",  icon: Target,        tourId: undefined,        tiers: ["hr_admin"] as RoleTier[] },
  { title: "Settings",              href: "/settings",              icon: Settings,      tourId: undefined,        tiers: ["hr_admin"] as RoleTier[] },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const { user, logout } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["employee-self", user?.employeeId],
    queryFn: () => getEmployee(user!.employeeId!),
    enabled: !!user?.employeeId,
    staleTime: 5 * 60 * 1000,
  });

  const roleTier: RoleTier = user ? getRoleTier(user) : "employee";
  const visibleNav      = ALL_MAIN_NAV.filter((i) =>
    i.tiers.includes(roleTier) && (i.href !== "/profile" || !!user?.employeeId)
  );
  const visibleAdminNav = ALL_ADMIN_NAV.filter((i) => i.tiers.includes(roleTier));

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : "—";

  const initials = profile
    ? `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()
    : "?";

  const roleDisplay = roleTierLabel(roleTier);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  const NavItem = ({
    item,
  }: {
    item: { title: string; href: string; icon: React.ElementType; tourId?: string };
  }) => {
    const isActive =
      location === item.href || location.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-normal dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        )}
        data-testid={`link-nav-${item.title.toLowerCase().replace(" ", "-")}`}
        data-tour={item.tourId}
        title={collapsed ? item.title : undefined}
      >
        <item.icon
          className={cn(
            "flex-shrink-0",
            collapsed ? "w-5 h-5" : "w-4 h-4",
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-400 dark:text-gray-500"
          )}
        />
        {!collapsed && item.title}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full transition-all duration-200",
          collapsed ? "w-14" : "w-52"
        )}
      >
        {/* Logo row */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100 dark:border-gray-800">
          {!collapsed && (
            <Link
              href="/home"
              className="flex items-center gap-2 min-w-0"
              data-testid="link-logo"
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(217,91%,60%)" }}
              >
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate tracking-tight">
                Sentient HRIS
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/home" className="mx-auto" data-testid="link-logo">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(217,91%,60%)" }}
              >
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              aria-label="Collapse sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Expand sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}

          {/* Admin section — only renders for tiers that have admin nav items */}
          {visibleAdminNav.length > 0 && (
            <div className="pt-4">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  Admin
                </p>
              )}
              {collapsed && (
                <div className="border-t border-gray-100 dark:border-gray-800 mx-1 mb-1" />
              )}
              {visibleAdminNav.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-2 space-y-1">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark((d) => !d)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm w-full transition-colors",
              "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
              collapsed && "justify-center px-0"
            )}
            aria-label="Toggle dark mode"
            data-testid="button-dark-mode"
            data-tour="dark-mode-toggle"
            title={
              collapsed ? (dark ? "Light mode" : "Dark mode") : undefined
            }
          >
            {dark ? (
              <Sun className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Moon className="w-4 h-4 flex-shrink-0" />
            )}
            {!collapsed && (
              <span className="text-xs">{dark ? "Light mode" : "Dark mode"}</span>
            )}
          </button>

          {/* User info + logout */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md",
              collapsed && "justify-center px-0"
            )}
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300 flex-shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate leading-tight">
                  {roleDisplay}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => void logout()}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                data-testid="button-logout"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 focus:outline-none relative">
        <div className="sticky top-0 z-20 flex h-12 justify-end border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div data-tour="notifications-bell">
            <NotificationsBell />
          </div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto p-8 animate-in fade-in duration-300">
          {children}
        </div>
      </main>

    </div>
  );
}
