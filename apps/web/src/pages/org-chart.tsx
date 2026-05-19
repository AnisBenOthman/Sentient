import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, Users, X } from "lucide-react";
import { getOrgChart, type OrgDepartment, type OrgEmployee, type OrgTeam } from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import { canViewEmployeeDetails } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  ON_LEAVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PROBATION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  TERMINATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  RESIGNED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30",
  "Human Resources": "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30",
  HR: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30",
  Finance: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30",
  Product: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30",
  Sales: "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30",
  Executive: "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30",
};

const DEPT_HEADER_COLORS: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  "Human Resources": "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  HR: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  Finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  Product: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  Sales: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  Executive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

const DEPT_TAB_COLORS: Record<string, string> = {
  Engineering: "bg-blue-600 text-white",
  "Human Resources": "bg-purple-600 text-white",
  HR: "bg-purple-600 text-white",
  Finance: "bg-emerald-600 text-white",
  Product: "bg-amber-500 text-white",
  Sales: "bg-rose-600 text-white",
  Executive: "bg-gray-600 text-white",
};

const TEAM_BADGE_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Human Resources": "bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  HR: "bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  Finance: "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  Product: "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  Sales: "bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  Executive: "bg-gray-50 border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300",
};

const PROFICIENCY_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isRecentJoiner(emp: OrgEmployee): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  return localDateString(new Date(emp.hireDate)) >= localDateString(cutoff);
}

function SkillTooltip({ skills }: { skills: OrgEmployee["skills"] }) {
  const topSkills = [...skills]
    .sort((a, b) => (PROFICIENCY_RANK[b.proficiency] ?? 0) - (PROFICIENCY_RANK[a.proficiency] ?? 0))
    .slice(0, 3);

  return (
    <div
      className="absolute z-50 bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg pointer-events-none dark:border-gray-600 dark:bg-gray-800"
      data-testid="skill-tooltip"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Top Skills
      </p>
      <div className="space-y-1.5">
        {topSkills.map(({ skill, proficiency }) => {
          const rank = PROFICIENCY_RANK[proficiency] ?? 0;
          return (
            <div key={skill}>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="truncate text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {skill}
                </span>
                <span className="ml-1 shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                  {rank}/4
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400" style={{ width: `${(rank / 4) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
    </div>
  );
}

function EmployeeCard({
  emp,
  highlighted,
  dimmed,
  isLead,
  canOpenDetails,
}: {
  emp: OrgEmployee;
  highlighted?: boolean;
  dimmed?: boolean;
  isLead?: boolean;
  canOpenDetails: boolean;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [, navigate] = useLocation();
  const initials = getInitials(emp.firstName, emp.lastName);

  return (
    <div
      className={[
        "relative w-40 rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-gray-800",
        canOpenDetails ? "cursor-pointer hover:shadow-md" : "",
        highlighted
          ? "scale-105 border-2 border-yellow-400 ring-2 ring-yellow-300/60 dark:border-yellow-400 dark:ring-yellow-500/40"
          : "border-gray-200 dark:border-gray-700",
        dimmed ? "opacity-30" : "",
      ].join(" ")}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onClick={() => {
        if (canOpenDetails) navigate(`/employees/${emp.id}`);
      }}
      onKeyDown={(event) => {
        if (!canOpenDetails) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/employees/${emp.id}`);
        }
      }}
      tabIndex={canOpenDetails ? 0 : undefined}
      role={canOpenDetails ? "button" : undefined}
      aria-label={canOpenDetails ? `View profile for ${emp.firstName} ${emp.lastName}` : undefined}
      data-testid={`employee-card-${emp.id}`}
    >
      {tooltipVisible && emp.skills.length > 0 && <SkillTooltip skills={emp.skills} />}
      {isLead && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          Lead
        </span>
      )}
      {isRecentJoiner(emp) && (
        <span
          className="absolute left-1.5 top-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-green-700 dark:bg-green-900/40 dark:text-green-300"
          title="Hired in the last 90 days"
        >
          New
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
            isLead
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          ].join(" ")}
        >
          {initials}
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold leading-tight text-gray-900 dark:text-gray-100">
            {emp.firstName} {emp.lastName}
          </p>
          <p className="mt-0.5 text-[10px] leading-tight text-gray-500 dark:text-gray-400">
            {emp.position?.title ?? "Unassigned"}
          </p>
        </div>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
            STATUS_COLORS[emp.employmentStatus] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {formatStatus(emp.employmentStatus)}
        </span>
      </div>
    </div>
  );
}

function VerticalConnector() {
  return <div className="mx-auto h-5 w-px bg-gray-300 dark:bg-gray-600" />;
}

function uniqueEmployees(root: OrgEmployee | null, departments: OrgDepartment[]): OrgEmployee[] {
  const byId = new Map<string, OrgEmployee>();
  if (root) byId.set(root.id, root);
  for (const department of departments) {
    if (department.head) byId.set(department.head.id, department.head);
    for (const team of department.teams) {
      for (const member of team.members) byId.set(member.id, member);
    }
  }
  return [...byId.values()];
}

function resolveTeamLead(members: OrgEmployee[], team: OrgTeam): OrgEmployee | undefined {
  const explicitLead = team.lead ? members.find((member) => member.id === team.lead?.id) : undefined;
  if (explicitLead) return explicitLead;
  const intraTeamManager = members.find((member) => members.some((candidate) => candidate.managerId === member.id));
  if (intraTeamManager) return intraTeamManager;
  return [...members].sort((a, b) => a.hireDate.localeCompare(b.hireDate))[0];
}

export default function OrgChart() {
  const { user } = useAuth();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["org-chart"],
    queryFn: getOrgChart,
  });

  const root = data?.root ?? null;
  const orgDepts = data?.departments ?? [];
  const allDepartments = [...new Set(orgDepts.map((department) => department.name))].sort((a, b) =>
    a.localeCompare(b),
  );
  const effectiveDept = selectedDept && allDepartments.includes(selectedDept) ? selectedDept : null;
  const visibleDepts = effectiveDept
    ? orgDepts.filter((department) => department.name === effectiveDept)
    : orgDepts;

  const allEmployees = useMemo(() => uniqueEmployees(root, orgDepts), [root, orgDepts]);
  const highlightedIds = useMemo(() => {
    const term = skillSearch.trim().toLowerCase();
    if (!term) return new Set<string>();
    return new Set(
      allEmployees
        .filter((employee) => employee.skills.some((skill) => skill.skill.toLowerCase().includes(term)))
        .map((employee) => employee.id),
    );
  }, [allEmployees, skillSearch]);

  const hasSkillFilter = skillSearch.trim().length > 0;
  const totalEmployees = allEmployees.length;
  const totalDepartments = orgDepts.length;
  const totalTeams = orgDepts.reduce((sum, department) => sum + department.teams.length, 0);

  function canOpenEmployeeDetails(emp: OrgEmployee): boolean {
    return user
      ? canViewEmployeeDetails(user, emp, {
          departments: orgDepts,
          teams: orgDepts.flatMap((department) => department.teams),
        })
      : false;
  }

  function toggleTeam(departmentId: string, teamId: string): void {
    const key = `${departmentId}:${teamId}`;
    setExpandedTeams((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isExpanded(departmentId: string, teamId: string): boolean {
    return expandedTeams.has(`${departmentId}:${teamId}`);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Org Chart</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Visual hierarchy of your organization</p>
        </div>
        <p className="py-12 text-center text-sm text-muted-foreground">Loading org chart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100" data-testid="heading-org-chart">
          Org Chart
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Visual hierarchy of your organization - Company, Department, Team, People
        </p>
      </div>

      <div className="flex flex-wrap gap-3" data-testid="org-stats-summary">
        {[
          { label: "Employees", value: totalEmployees, testId: "stat-total-employees" },
          { label: "Departments", value: totalDepartments, testId: "stat-total-departments" },
          { label: "Teams", value: totalTeams, testId: "stat-total-teams" },
        ].map(({ label, value, testId }) => (
          <div
            key={label}
            data-testid={testId}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3" data-testid="org-filter-bar">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDept(null)}
            data-testid="dept-tab-all"
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              effectiveDept === null
                ? "bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
            ].join(" ")}
          >
            All
          </button>
          {allDepartments.map((dept) => {
            const isActive = effectiveDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(isActive ? null : dept)}
                data-testid={`dept-tab-${dept.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  isActive
                    ? DEPT_TAB_COLORS[dept] ?? "bg-gray-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                ].join(" ")}
              >
                {dept}
              </button>
            );
          })}
        </div>

        <div className="hidden h-5 w-px bg-gray-200 dark:bg-gray-700 sm:block" />

        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by skill..."
            value={skillSearch}
            onChange={(event) => setSkillSearch(event.target.value)}
            data-testid="skill-search-input"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          {skillSearch && (
            <button
              onClick={() => setSkillSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Clear skill search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasSkillFilter && (
          <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="skill-match-count">
            {highlightedIds.size} {highlightedIds.size === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-fit flex-col items-center">
          {root ? (
            <>
              <EmployeeCard
                emp={root}
                highlighted={highlightedIds.has(root.id)}
                dimmed={hasSkillFilter && !highlightedIds.has(root.id)}
                isLead
                canOpenDetails={canOpenEmployeeDetails(root)}
              />
              <VerticalConnector />
            </>
          ) : null}

          {visibleDepts.length > 0 ? (
            <div className="relative flex items-start">
              {visibleDepts.length > 1 && <div className="absolute left-0 right-0 top-0 h-px bg-gray-300 dark:bg-gray-600" />}
              <div className="flex gap-6">
                {visibleDepts.map((dept) => {
                  const deptColor = DEPT_COLORS[dept.name] ?? "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/30";
                  const headerColor = DEPT_HEADER_COLORS[dept.name] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
                  const teamBadgeColor = TEAM_BADGE_COLORS[dept.name] ?? "bg-gray-50 border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300";
                  const totalMembers = new Set([
                    ...(dept.head ? [dept.head.id] : []),
                    ...dept.teams.flatMap((team) => team.members.map((member) => member.id)),
                  ]).size;

                  return (
                    <div key={dept.id} className="flex flex-col items-center">
                      {root && <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />}
                      <div className={`rounded-xl border p-4 ${deptColor}`} data-testid={`dept-branch-${dept.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                        <div className={`mb-4 rounded-md px-2 py-1.5 text-center ${headerColor}`}>
                          <div className="text-xs font-bold uppercase tracking-wider">{dept.name}</div>
                          <div className="mt-1 flex items-center justify-center gap-2 opacity-75">
                            <span className="text-[10px] font-medium">{dept.code}</span>
                            <span className="text-[10px] opacity-50">-</span>
                            <span className="text-[10px] font-medium">
                              {dept.teams.length} {dept.teams.length === 1 ? "team" : "teams"}
                            </span>
                            <span className="text-[10px] opacity-50">-</span>
                            <span className="text-[10px] font-medium">
                              {totalMembers} {totalMembers === 1 ? "member" : "members"}
                            </span>
                          </div>
                        </div>

                        {dept.head && (
                          <div className="mb-4 flex flex-col items-center">
                            <EmployeeCard
                              emp={dept.head}
                              highlighted={highlightedIds.has(dept.head.id)}
                              dimmed={hasSkillFilter && !highlightedIds.has(dept.head.id)}
                              isLead
                              canOpenDetails={canOpenEmployeeDetails(dept.head)}
                            />
                            {dept.teams.length > 0 && <div className="mt-2 h-4 w-px bg-gray-300 dark:bg-gray-600" />}
                          </div>
                        )}

                        <div className="space-y-4">
                          {dept.teams.map((team) => {
                            const members = team.members.filter((member) => member.id !== dept.headId);
                            const expanded = isExpanded(dept.id, team.id);
                            const lead = resolveTeamLead(members, team);
                            const visibleMembers = expanded ? members : lead ? [lead] : [];
                            const teamTestId = team.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

                            return (
                              <div key={team.id} className="flex flex-col items-center gap-2" data-testid={`team-group-${teamTestId}`}>
                                <button
                                  onClick={() => toggleTeam(dept.id, team.id)}
                                  aria-expanded={expanded}
                                  aria-label={`${expanded ? "Collapse" : "Expand"} ${team.name} team`}
                                  data-testid={`team-badge-${teamTestId}`}
                                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all hover:brightness-95 ${teamBadgeColor}`}
                                >
                                  <Users className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                                  {team.name}
                                  <span className="mx-0.5 opacity-40">-</span>
                                  <span className="opacity-75">{members.length}</span>
                                  <ChevronDown className={`ml-0.5 h-2.5 w-2.5 opacity-60 transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
                                </button>

                                <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />

                                {visibleMembers.length > 0 ? (
                                  <div className="flex gap-3">
                                    {visibleMembers.map((emp) => (
                                      <EmployeeCard
                                        key={emp.id}
                                        emp={emp}
                                        highlighted={highlightedIds.has(emp.id)}
                                        dimmed={hasSkillFilter && !highlightedIds.has(emp.id)}
                                        isLead={emp.id === lead?.id}
                                        canOpenDetails={canOpenEmployeeDetails(emp)}
                                      />
                                    ))}
                                  </div>
                                ) : team.leadVacant ? (
                                  <div className="flex h-16 w-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                                    <span className="text-[10px] italic text-gray-400">Lead vacant</span>
                                  </div>
                                ) : (
                                  <p className="text-[10px] italic text-gray-400">No members yet</p>
                                )}
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
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No departments found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
