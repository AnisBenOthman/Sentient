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
  Megaphone,
  FileText,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider";
import { getEmployee } from "@/lib/api/hr-core";
import { getRoleTier, roleTierLabelKey, type RoleTier } from "@/lib/auth";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";
import { LanguageSwitcher } from "@/components/language-switcher";
import type enNav from "@/i18n/locales/en/nav.json";

type NavKey = keyof typeof enNav;

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * WHY: `navKey` is a nav.json key resolved at render time, and `testId` is a
 * fixed slug. They are deliberately separate: deriving the test-id from the
 * label (as this did before i18n) would rename every selector to French the
 * moment the user switches language.
 */
interface NavEntry {
  navKey: NavKey;
  testId: string;
  href: string;
  icon: React.ElementType;
  tourId?: string;
  tiers: RoleTier[];
}

const ALL_MAIN_NAV: NavEntry[] = [
  { navKey: "home",               testId: "home",                href: "/home",                icon: Home,            tourId: "home-nav",          tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "myProfile",          testId: "my-profile",          href: "/profile",             icon: UserRound,       tourId: "profile-nav",       tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "dashboard",          testId: "dashboard",           href: "/dashboard",           icon: LayoutDashboard, tourId: "dashboard-nav",     tiers: ["hr_admin", "dept_manager", "team_lead"] },
  { navKey: "employees",          testId: "employees",           href: "/employees",           icon: Users,           tourId: "employees-nav",     tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "leaves",             testId: "leaves",              href: "/leaves",              icon: CalendarDays,    tourId: "leaves-nav",        tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "orgChart",           testId: "org-chart",           href: "/org-chart",           icon: GitFork,         tourId: "org-chart-nav",     tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "performanceReviews", testId: "performance-reviews", href: "/performance-reviews", icon: ClipboardCheck,  tourId: "performance-nav",   tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "myOkrs",             testId: "okrs",                href: "/okrs",                icon: Target,          tourId: "okrs-nav",          tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "announcements",      testId: "announcements",       href: "/announcements",       icon: Megaphone,       tourId: undefined,           tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "events",             testId: "events",              href: "/events",              icon: CalendarDays,    tourId: undefined,           tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "documents",          testId: "documents",           href: "/documents",           icon: FileText,        tourId: undefined,           tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "aiAssistant",        testId: "ai-assistant",        href: "/ai-assistant",        icon: Bot,             tourId: undefined,           tiers: ["hr_admin", "dept_manager", "team_lead", "employee"] },
  { navKey: "simulation",         testId: "simulation",          href: "/simulation",          icon: Sparkles,        tourId: "simulation-nav",    tiers: ["hr_admin", "dept_manager", "team_lead"] },
];

const ALL_ADMIN_NAV: NavEntry[] = [
  { navKey: "positions",       testId: "positions",        href: "/positions",        icon: Briefcase,     tourId: "positions-nav",  tiers: ["hr_admin"] },
  { navKey: "leaveManagement", testId: "leave-management", href: "/leave-management", icon: CalendarClock, tourId: "leave-mgmt-nav", tiers: ["hr_admin"] },
  { navKey: "settings",        testId: "settings",         href: "/settings",         icon: Settings,      tourId: undefined,        tiers: ["hr_admin"] },
];

interface NavItemProps {
  item: NavEntry;
  collapsed: boolean;
}

function NavItem({ item, collapsed }: NavItemProps) {
  const [location] = useLocation();
  const { t } = useTranslation("nav");
  const isActive =
    location === item.href || location.startsWith(item.href + "/");
  const label = t(item.navKey);
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
      data-testid={`link-nav-${item.testId}`}
      data-tour={item.tourId}
      title={collapsed ? label : undefined}
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
      {!collapsed && label}
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const { user, logout } = useAuth();
  const { t } = useTranslation(["nav", "common"]);

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

  const roleDisplay = t(roleTierLabelKey(roleTier), { ns: "common" });
  const showFloatingAssistant = location !== "/ai-assistant";

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

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
              aria-label={t("nav:collapseMenu")}
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
              aria-label={t("nav:expandMenu")}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map((item) => (
            <NavItem key={item.href} item={item} collapsed={collapsed} />
          ))}

          {/* Admin section — only renders for tiers that have admin nav items */}
          {visibleAdminNav.length > 0 && (
            <div className="pt-4">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  {t("nav:admin")}
                </p>
              )}
              {collapsed && (
                <div className="border-t border-gray-100 dark:border-gray-800 mx-1 mb-1" />
              )}
              {visibleAdminNav.map((item) => (
                <NavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-2 space-y-1">
          {/* Language switcher */}
          <LanguageSwitcher collapsed={collapsed} />

          {/* Dark mode toggle */}
          <button
            onClick={() => setDark((d) => !d)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm w-full transition-colors",
              "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
              collapsed && "justify-center px-0"
            )}
            aria-label={dark ? t("nav:lightMode") : t("nav:darkMode")}
            data-testid="button-dark-mode"
            data-tour="dark-mode-toggle"
            title={
              collapsed
                ? dark
                  ? t("nav:lightMode")
                  : t("nav:darkMode")
                : undefined
            }
          >
            {dark ? (
              <Sun className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Moon className="w-4 h-4 flex-shrink-0" />
            )}
            {!collapsed && (
              <span className="text-xs">
                {dark ? t("nav:lightMode") : t("nav:darkMode")}
              </span>
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
                title={t("nav:signOut")}
                aria-label={t("nav:signOut")}
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
      {showFloatingAssistant && <FloatingAiAssistant />}

    </div>
  );
}
