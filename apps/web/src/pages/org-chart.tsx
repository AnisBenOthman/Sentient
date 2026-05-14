import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getOrgChart, getEmployees, type OrgDepartment, type EmployeeProfile } from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import { canViewEmployeeDetails } from "@/lib/auth";

const DEPT_COLORS: Record<string, string> = {
  Engineering: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30",
  Marketing: "border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/30",
  HR: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30",
  Finance: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30",
  Product: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30",
};

const DEPT_HEADER_COLORS: Record<string, string> = {
  Engineering: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  Marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200",
  HR: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  Finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  Product: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
};

const DEPT_TAB_COLORS: Record<string, string> = {
  Engineering: "bg-blue-600 text-white",
  Marketing: "bg-pink-500 text-white",
  HR: "bg-purple-600 text-white",
  Finance: "bg-emerald-600 text-white",
  Product: "bg-amber-500 text-white",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  ON_LEAVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PROBATION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  TERMINATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatStatus(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}

function EmployeeCard({
  emp,
  highlighted,
  dimmed,
  isLead,
  canOpenDetails,
}: {
  emp: EmployeeProfile;
  highlighted?: boolean;
  dimmed?: boolean;
  isLead?: boolean;
  canOpenDetails: boolean;
}) {
  const [, navigate] = useLocation();
  const initials = getInitials(emp.firstName, emp.lastName);

  return (
    <div
      className={[
        "relative bg-white dark:bg-gray-800 border rounded-xl p-3 w-40 shadow-sm transition-all",
        canOpenDetails ? "hover:shadow-md cursor-pointer" : "",
        highlighted
          ? "border-2 border-yellow-400 dark:border-yellow-400 ring-2 ring-yellow-300/60 scale-105"
          : "border-gray-200 dark:border-gray-700",
        dimmed ? "opacity-30" : "",
      ].join(" ")}
      onClick={() => {
        if (canOpenDetails) navigate(`/employees/${emp.id}`);
      }}
      onKeyDown={(e) => {
        if (!canOpenDetails) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/employees/${emp.id}`);
        }
      }}
      tabIndex={canOpenDetails ? 0 : undefined}
      role={canOpenDetails ? "button" : undefined}
      aria-label={canOpenDetails ? `View profile for ${emp.firstName} ${emp.lastName}` : undefined}
      data-testid={`employee-card-${emp.id}`}
    >
      {isLead && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 leading-none">
          Lead
        </span>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={[
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
            isLead
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
          ].join(" ")}
        >
          {initials}
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {emp.firstName} {emp.lastName}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
            {emp.position?.title ?? "—"}
          </p>
        </div>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${
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
  return <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-auto" />;
}

export default function OrgChart() {
  const { user } = useAuth();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const { data: orgDepts = [], isLoading: loadingOrg } = useQuery({
    queryKey: ["org-chart"],
    queryFn: getOrgChart,
  });

  const { data: empResult, isLoading: loadingEmps } = useQuery({
    queryKey: ["employees", { limit: 500 }],
    queryFn: () => getEmployees({ limit: 500 }),
  });

  const allEmployees: EmployeeProfile[] = empResult?.data ?? [];
  const isLoading = loadingOrg || loadingEmps;

  const empById = useMemo(() => {
    const m = new Map<string, EmployeeProfile>();
    for (const e of allEmployees) m.set(e.id, e);
    return m;
  }, [allEmployees]);

  const empsByTeam = useMemo(() => {
    const m = new Map<string, EmployeeProfile[]>();
    for (const e of allEmployees) {
      if (!e.team?.id) continue;
      if (!m.has(e.team.id)) m.set(e.team.id, []);
      m.get(e.team.id)!.push(e);
    }
    return m;
  }, [allEmployees]);

  const empsByDept = useMemo(() => {
    const m = new Map<string, EmployeeProfile[]>();
    for (const e of allEmployees) {
      if (!e.department?.id) continue;
      if (!m.has(e.department.id)) m.set(e.department.id, []);
      m.get(e.department.id)!.push(e);
    }
    return m;
  }, [allEmployees]);

  const allDepartments = orgDepts.map((d) => d.name);

  const effectiveDept = selectedDept && allDepartments.includes(selectedDept)
    ? selectedDept
    : null;
  const visibleDepts = effectiveDept
    ? orgDepts.filter((d) => d.name === effectiveDept)
    : orgDepts;

  const totalEmployees = allEmployees.length;
  const totalDepartments = orgDepts.length;
  const totalTeams = orgDepts.reduce((sum, d) => sum + d.teams.length, 0);

  function canOpenEmployeeDetails(emp: EmployeeProfile): boolean {
    return user
      ? canViewEmployeeDetails(user, emp, {
          departments: orgDepts,
          teams: orgDepts.flatMap((department) => department.teams),
        })
      : false;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Org Chart</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visual hierarchy of your organization</p>
        </div>
        <p className="text-sm text-muted-foreground py-12 text-center">Loading org chart…</p>
      </div>
    );
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
      </div>

      {/* Department tab filter */}
      <div className="flex flex-wrap items-center gap-1.5" data-testid="org-filter-bar">
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

      {/* Department cards */}
      <div className="space-y-8">
        {visibleDepts.map((dept) => {
          const deptColorCard = DEPT_COLORS[dept.name] ?? "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30";
          const deptColorHeader = DEPT_HEADER_COLORS[dept.name] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
          const deptHead = dept.headId ? empById.get(dept.headId) : undefined;
          const deptEmps = empsByDept.get(dept.id) ?? [];

          return (
            <div
              key={dept.id}
              className={`border rounded-2xl overflow-hidden ${deptColorCard}`}
              data-testid={`dept-section-${dept.name.toLowerCase()}`}
            >
              {/* Department header */}
              <div className={`px-5 py-3 flex items-center justify-between ${deptColorHeader}`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{dept.name}</span>
                  <span className="text-xs opacity-70">({dept.code})</span>
                </div>
                <span className="text-xs font-medium opacity-70">
                  {deptEmps.length} member{deptEmps.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-5 space-y-6">
                {/* Department head */}
                {deptHead && (
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Department Head
                    </p>
                    <EmployeeCard emp={deptHead} isLead canOpenDetails={canOpenEmployeeDetails(deptHead)} />
                    <VerticalConnector />
                  </div>
                )}

                {/* Teams */}
                {dept.teams.length > 0 ? (
                  <div className="flex flex-wrap gap-6 justify-center">
                    {dept.teams.map((team) => {
                      const teamEmps = (empsByTeam.get(team.id) ?? []).filter(
                        (e) => e.id !== dept.headId,
                      );
                      const lead = team.leadId ? empById.get(team.leadId) : undefined;
                      const members = teamEmps.filter((e) => e.id !== team.leadId);

                      return (
                        <div
                          key={team.id}
                          className="flex flex-col items-center gap-2"
                          data-testid={`team-section-${team.name}`}
                        >
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            {team.name}
                          </div>

                          {/* Team lead */}
                          {lead && (
                            <>
                              <EmployeeCard emp={lead} isLead canOpenDetails={canOpenEmployeeDetails(lead)} />
                              {members.length > 0 && <VerticalConnector />}
                            </>
                          )}

                          {/* Team members */}
                          {members.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {members.map((emp) => (
                                <EmployeeCard key={emp.id} emp={emp} canOpenDetails={canOpenEmployeeDetails(emp)} />
                              ))}
                            </div>
                          )}

                          {teamEmps.length === 0 && !team.leadVacant && (
                            <p className="text-[10px] text-gray-400 italic">No members yet</p>
                          )}
                          {team.leadVacant && (
                            <div className="w-40 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center">
                              <span className="text-[10px] text-gray-400 italic">Lead vacant</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // No teams — show employees directly
                  deptEmps.filter((e) => e.id !== dept.headId).length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {deptEmps
                        .filter((e) => e.id !== dept.headId)
                        .map((emp) => (
                          <EmployeeCard key={emp.id} emp={emp} canOpenDetails={canOpenEmployeeDetails(emp)} />
                        ))}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}

        {visibleDepts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            No departments found.
          </p>
        )}
      </div>
    </div>
  );
}
