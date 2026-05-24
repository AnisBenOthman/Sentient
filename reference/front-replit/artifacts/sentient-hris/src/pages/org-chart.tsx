import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { employees, employeeExtras } from "@/lib/mock-data";

type Employee = (typeof employees)[number];

function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = localDateString();

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_COLORS: Record<string, string> = {
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "on-leave":
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  remote: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30",
  Marketing:   "border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/30",
  HR:          "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30",
  Finance:     "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30",
  Product:     "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30",
  Executive:   "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30",
};

const DEPT_HEADER_COLORS: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  Marketing:   "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200",
  HR:          "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  Finance:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  Product:     "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  Executive:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

const DEPT_TAB_COLORS: Record<string, string> = {
  Engineering: "bg-blue-600 text-white",
  Marketing:   "bg-pink-500 text-white",
  HR:          "bg-purple-600 text-white",
  Finance:     "bg-emerald-600 text-white",
  Product:     "bg-amber-500 text-white",
  Executive:   "bg-gray-600 text-white",
};

const TEAM_BADGE_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  Marketing:   "bg-pink-50 border border-pink-200 text-pink-700 dark:bg-pink-950/40 dark:border-pink-800 dark:text-pink-300",
  HR:          "bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  Finance:     "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  Product:     "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  Executive:   "bg-gray-50 border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300",
};

function SkillTooltip({ skills }: { skills: Employee["skills"] }) {
  const top3 = [...skills].sort((a, b) => b.level - a.level).slice(0, 3);
  return (
    <div
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2.5 pointer-events-none"
      data-testid="skill-tooltip"
    >
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Top Skills
      </p>
      <div className="space-y-1.5">
        {top3.map(({ skill, level }) => (
          <div key={skill}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">
                {skill}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1 shrink-0">
                {level}/5
              </span>
            </div>
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                style={{ width: `${(level / 5) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-600 -z-10" />
    </div>
  );
}

function EmployeeCard({
  emp,
  highlighted,
  dimmed,
  isNew,
}: {
  emp: Employee;
  highlighted?: boolean;
  dimmed?: boolean;
  isNew?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [, navigate] = useLocation();

  return (
    <div
      className={[
        "relative bg-white dark:bg-gray-800 border rounded-xl p-3 w-40 shadow-sm hover:shadow-md transition-all cursor-pointer",
        highlighted
          ? "border-2 border-yellow-400 dark:border-yellow-400 ring-2 ring-yellow-300/60 dark:ring-yellow-500/40 scale-105"
          : "border-gray-200 dark:border-gray-700",
        dimmed ? "opacity-30" : "",
      ].join(" ")}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => navigate(`/employees/${emp.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/employees/${emp.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View profile for ${emp.name}`}
      data-testid={`employee-card-${emp.id}`}
    >
      {visible && emp.skills.length > 0 && (
        <SkillTooltip skills={emp.skills} />
      )}
      {isNew && (
        <span
          className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 leading-none"
          data-testid={`new-badge-${emp.id}`}
          title="Hired in the last 90 days"
        >
          New
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={[
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
            highlighted
              ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
              : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
          ].join(" ")}
        >
          {getInitials(emp.name)}
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {emp.name}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
            {emp.role}
          </p>
        </div>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${
            STATUS_COLORS[emp.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {emp.status}
        </span>
      </div>
    </div>
  );
}

function VerticalConnector() {
  return <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-auto" />;
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OrgChart() {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [asOfDate, setAsOfDate] = useState(TODAY);

  const isToday = asOfDate === TODAY;

  // ── Filter employees by hire date ─────────────────────────────────────────
  // CEO (managerId === null) is always included. Everyone else must have been
  // hired on or before the selected date.
  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.managerId === null || e.hireDate <= asOfDate),
    [asOfDate]
  );

  // ── Derive org structure from filtered list ───────────────────────────────
  const root = filteredEmployees.find((e) => e.managerId === null);

  const deptMap = useMemo(
    () =>
      filteredEmployees
        .filter((e) => e.managerId !== null)
        .reduce<Record<string, Employee[]>>((acc, emp) => {
          if (!acc[emp.department]) acc[emp.department] = [];
          acc[emp.department].push(emp);
          return acc;
        }, {}),
    [filteredEmployees]
  );

  const allDepartments = useMemo(() => Object.keys(deptMap).sort(), [deptMap]);

  // Reset department filter if it disappears after date change
  const effectiveDept =
    selectedDept && allDepartments.includes(selectedDept) ? selectedDept : null;
  const effectiveVisible = effectiveDept ? [effectiveDept] : allDepartments;

  // ── Recent joiner cutoff (90 days before asOfDate) ───────────────────────
  const newJoinerCutoff = useMemo(() => {
    const d = new Date(asOfDate + "T00:00:00");
    d.setDate(d.getDate() - 90);
    return localDateString(d);
  }, [asOfDate]);

  const isRecentJoiner = (emp: Employee) =>
    emp.hireDate >= newJoinerCutoff && emp.hireDate <= asOfDate;

  const highlightedIds = useMemo<Set<string>>(() => {
    if (!skillSearch.trim()) return new Set();
    const term = skillSearch.trim().toLowerCase();
    const ids = new Set<string>();
    for (const emp of filteredEmployees) {
      if (emp.skills.some((s) => s.skill.toLowerCase().includes(term))) {
        ids.add(emp.id);
      }
    }
    return ids;
  }, [skillSearch, filteredEmployees]);

  const hasSkillFilter = skillSearch.trim().length > 0;

  // ── Stats (all derived from filteredEmployees / deptMap) ──────────────────
  const totalEmployees = filteredEmployees.length;
  const totalDepartments = allDepartments.length;
  const totalTeams = useMemo(() => {
    const teams = new Set<string>();
    for (const emp of filteredEmployees) {
      if (emp.managerId !== null) {
        teams.add(employeeExtras[emp.id]?.team ?? "General");
      }
    }
    return teams.size;
  }, [filteredEmployees]);

  // ── Department head ───────────────────────────────────────────────────────
  // The department head is the person in that dept who reports directly to the
  // root (CEO). They are shown prominently above the teams, always visible.
  function getDeptHead(dept: string): Employee | undefined {
    return (deptMap[dept] ?? []).find((e) => e.managerId === root?.id);
  }

  function getTeamGroups(dept: string): { teamName: string; emps: Employee[] }[] {
    const deptHead = getDeptHead(dept);
    // Exclude the department head from team groupings — they appear above
    const depEmps = (deptMap[dept] ?? []).filter((e) => e.id !== deptHead?.id);
    const grouped = new Map<string, Employee[]>();
    for (const emp of depEmps) {
      const team = employeeExtras[emp.id]?.team ?? "General";
      if (!grouped.has(team)) grouped.set(team, []);
      grouped.get(team)!.push(emp);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([teamName, emps]) => ({ teamName, emps }));
  }

  // ── Team lead resolution ──────────────────────────────────────────────────
  // 1. Member whose id appears as another member's managerId (intra-team lead)
  // 2. Fallback: highest salary
  // 3. Tiebreak: lowest numeric id (earliest hire)
  function getTeamLead(emps: Employee[]): Employee {
    const intraMgr = emps.find((e) => emps.some((m) => m.managerId === e.id));
    if (intraMgr) return intraMgr;
    return emps.reduce((best, cur) => {
      if (cur.salary > best.salary) return cur;
      if (cur.salary === best.salary && Number(cur.id) < Number(best.id)) return cur;
      return best;
    });
  }

  // ── Expanded teams state ──────────────────────────────────────────────────
  // Key format: "dept::teamName". Default: all collapsed.
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  function toggleTeam(dept: string, teamName: string) {
    const key = `${dept}::${teamName}`;
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isExpanded(dept: string, teamName: string) {
    return expandedTeams.has(`${dept}::${teamName}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
          data-testid="heading-org-chart"
        >
          Org Chart
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visual hierarchy of your organization — Department → Team → People
        </p>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap gap-3" data-testid="org-stats-summary">
        {[
          { label: "Employees", value: totalEmployees, testId: "stat-total-employees" },
          { label: "Departments", value: totalDepartments, testId: "stat-total-departments" },
          { label: "Teams", value: totalTeams, testId: "stat-total-teams" },
        ].map(({ label, value, testId }) => (
          <div
            key={label}
            data-testid={testId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}

        {/* Historical banner */}
        {!isToday && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
            data-testid="as-of-banner"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Showing org as of {formatDisplayDate(asOfDate)}</span>
            <button
              onClick={() => setAsOfDate(TODAY)}
              className="ml-1 text-[10px] underline underline-offset-2 hover:no-underline"
              data-testid="reset-to-today"
            >
              Back to today
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3" data-testid="org-filter-bar">
        {/* Department tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDept(null)}
            data-testid="dept-tab-all"
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              effectiveDept === null
                ? "bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
            ].join(" ")}
          >
            All
          </button>
          {allDepartments.map((dept) => {
            const activeColor = DEPT_TAB_COLORS[dept] ?? "bg-gray-600 text-white";
            const isActive = effectiveDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(isActive ? null : dept)}
                data-testid={`dept-tab-${dept.toLowerCase()}`}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  isActive
                    ? activeColor
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                ].join(" ")}
              >
                {dept}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

        {/* Skill search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by skill…"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            data-testid="skill-search-input"
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {skillSearch && (
            <button
              onClick={() => setSkillSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Clear skill search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {hasSkillFilter && (
          <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="skill-match-count">
            {highlightedIds.size} {highlightedIds.size === 1 ? "match" : "matches"}
          </span>
        )}

        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

        {/* As-of date picker */}
        <div className="flex items-center gap-1.5" data-testid="as-of-date-control">
          <label
            htmlFor="as-of-date"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
          >
            As of
          </label>
          <input
            id="as-of-date"
            type="date"
            value={asOfDate}
            max={TODAY}
            onChange={(e) => {
              if (e.target.value) setAsOfDate(e.target.value);
            }}
            data-testid="as-of-date-input"
            className="py-1 px-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {!isToday && (
            <button
              onClick={() => setAsOfDate(TODAY)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              data-testid="reset-date-button"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 overflow-x-auto">
        <div className="flex flex-col items-center min-w-fit">
          {root ? (
            <>
              {/* CEO at top */}
              <EmployeeCard
                emp={root}
                highlighted={highlightedIds.has(root.id)}
                dimmed={hasSkillFilter && !highlightedIds.has(root.id)}
                isNew={isRecentJoiner(root)}
              />
              <VerticalConnector />

              {effectiveVisible.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-8">
                  No employees had joined yet by {formatDisplayDate(asOfDate)}.
                </p>
              ) : (
                /* Horizontal bar connecting departments */
                <div className="relative flex items-start">
                  {effectiveVisible.length > 1 && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gray-300 dark:bg-gray-600" />
                  )}
                  <div className="flex gap-6">
                    {effectiveVisible.map((dept) => {
                      const depColor = DEPT_COLORS[dept] ?? "border-gray-200 bg-gray-50/50";
                      const headerColor = DEPT_HEADER_COLORS[dept] ?? "bg-gray-100 text-gray-700";
                      const teamBadgeColor = TEAM_BADGE_COLORS[dept] ?? "bg-gray-50 border border-gray-200 text-gray-600";
                      const teamGroups = getTeamGroups(dept);

                      const deptHead = getDeptHead(dept);

                      return (
                        <div key={dept} className="flex flex-col items-center">
                          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

                          {/* Department box */}
                          <div
                            className={`border rounded-xl p-4 ${depColor}`}
                            data-testid={`dept-branch-${dept.toLowerCase()}`}
                          >
                            {/* Department label + stats */}
                            {(() => {
                              const totalMembers = teamGroups.reduce((sum, { emps }) => sum + emps.length, 0);
                              const totalDeptMembers = totalMembers + (deptHead ? 1 : 0);
                              return (
                                <div className={`px-2 py-1.5 rounded-md mb-4 text-center ${headerColor}`}>
                                  <div className="text-xs font-bold uppercase tracking-wider">
                                    {dept}
                                  </div>
                                  <div className="flex items-center justify-center gap-2 mt-1 opacity-75">
                                    <span className="text-[10px] font-medium">
                                      {teamGroups.length} {teamGroups.length === 1 ? "team" : "teams"}
                                    </span>
                                    <span className="text-[10px] opacity-50">·</span>
                                    <span className="text-[10px] font-medium">
                                      {totalDeptMembers} {totalDeptMembers === 1 ? "member" : "members"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Department head — always visible above the teams */}
                            {deptHead && (
                              <div className="flex flex-col items-center mb-4">
                                <EmployeeCard
                                  emp={deptHead}
                                  highlighted={highlightedIds.has(deptHead.id)}
                                  dimmed={hasSkillFilter && !highlightedIds.has(deptHead.id)}
                                  isNew={isRecentJoiner(deptHead)}
                                />
                                {teamGroups.length > 0 && (
                                  <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mt-2" />
                                )}
                              </div>
                            )}

                            {/* Teams within the department */}
                            <div className="space-y-4">
                              {teamGroups.map(({ teamName, emps }) => {
                                const expanded = isExpanded(dept, teamName);
                                const lead = getTeamLead(emps);
                                const visibleEmps = expanded ? emps : [lead];
                                return (
                                  <div
                                    key={teamName}
                                    className="flex flex-col items-center gap-2"
                                    data-testid={`team-group-${teamName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                                  >
                                    {/* Team badge — clickable toggle */}
                                    <button
                                      onClick={() => toggleTeam(dept, teamName)}
                                      aria-expanded={expanded}
                                      aria-label={`${expanded ? "Collapse" : "Expand"} ${teamName} team`}
                                      data-testid={`team-badge-${teamName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer hover:brightness-95 transition-all ${teamBadgeColor}`}
                                    >
                                      {/* people icon */}
                                      <svg
                                        className="w-3 h-3 opacity-70 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                      </svg>
                                      {teamName}
                                      <span className="opacity-40 mx-0.5">·</span>
                                      <span className="opacity-75">{emps.length}</span>
                                      {/* chevron */}
                                      <svg
                                        className={`w-2.5 h-2.5 ml-0.5 opacity-60 transition-transform ${expanded ? "" : "-rotate-90"}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>

                                    {/* Connector from team badge down to cards */}
                                    <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />

                                    {/* Employee cards — lead only (collapsed) or all (expanded) */}
                                    <div className="flex gap-3">
                                      {visibleEmps.map((emp) => (
                                        <EmployeeCard
                                          key={emp.id}
                                          emp={emp}
                                          highlighted={highlightedIds.has(emp.id)}
                                          dimmed={hasSkillFilter && !highlightedIds.has(emp.id)}
                                          isNew={isRecentJoiner(emp)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No employees found for the selected date.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
