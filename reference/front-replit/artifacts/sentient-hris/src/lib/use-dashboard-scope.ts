import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import {
  employees,
  leaveRequests,
  employeeExtras,
} from "./mock-data";
import {
  useOrgStructure,
  type BusinessUnit,
  type Department,
  type Team,
} from "./org-structure-store";

export type ScopeLevel = "global" | "bu" | "dept" | "team";

export type DashboardTab =
  | "overview"
  | "employees"
  | "leave"
  | "skills"
  | "promotions"
  | "engagement";

export const DASHBOARD_TABS: DashboardTab[] = [
  "overview",
  "employees",
  "leave",
  "skills",
  "promotions",
  "engagement",
];

export type DashboardScope = {
  level: ScopeLevel;
  unitId: string | null;
  unit: BusinessUnit | Department | Team | null;
  unitName: string | null;
  unitLabel: string;
  scopeLabel: string;
  scopedEmployees: typeof employees;
  scopedLeaveRequests: typeof leaveRequests;
  setScope: (level: ScopeLevel, unitId?: string | null) => void;
  tab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
  unitOptions: { value: string; label: string }[];
};

function parseTab(value: string | null): DashboardTab {
  return DASHBOARD_TABS.includes(value as DashboardTab)
    ? (value as DashboardTab)
    : "overview";
}

function parseLevel(value: string | null): ScopeLevel {
  if (value === "bu" || value === "dept" || value === "team") return value;
  return "global";
}

/**
 * Compute the new (level, unitId) when the user switches granularity, keeping
 * the parent/child relationship where possible.
 */
function computeReparent(
  fromLevel: ScopeLevel,
  fromUnitId: string | null,
  toLevel: ScopeLevel,
  org: ReturnType<typeof useOrgStructure>
): { level: ScopeLevel; unitId: string | null } {
  if (toLevel === "global") return { level: "global", unitId: null };

  const { businessUnits, departments, teams } = org;

  // Find the BU id implied by the current selection
  const findBuId = (): string | null => {
    if (fromLevel === "bu") return fromUnitId;
    if (fromLevel === "dept") {
      const d = departments.find((x) => x.id === fromUnitId);
      return d?.buId ?? null;
    }
    if (fromLevel === "team") {
      const t = teams.find((x) => x.id === fromUnitId);
      const d = t ? departments.find((x) => x.id === t.departmentId) : null;
      return d?.buId ?? null;
    }
    return null;
  };

  // Find the dept id implied by current selection
  const findDeptId = (): string | null => {
    if (fromLevel === "dept") return fromUnitId;
    if (fromLevel === "team") {
      const t = teams.find((x) => x.id === fromUnitId);
      return t?.departmentId ?? null;
    }
    if (fromLevel === "bu") {
      const first = departments.find((d) => d.buId === fromUnitId);
      return first?.id ?? null;
    }
    return null;
  };

  if (toLevel === "bu") {
    const buId = findBuId() ?? businessUnits[0]?.id ?? null;
    return { level: "bu", unitId: buId };
  }

  if (toLevel === "dept") {
    const buId = findBuId();
    const deptId =
      findDeptId() ??
      (buId
        ? departments.find((d) => d.buId === buId)?.id ?? null
        : departments[0]?.id ?? null);
    return { level: "dept", unitId: deptId };
  }

  // toLevel === "team"
  const deptId = findDeptId();
  const teamId =
    fromLevel === "team"
      ? fromUnitId
      : deptId
        ? teams.find((t) => t.departmentId === deptId)?.id ?? null
        : teams[0]?.id ?? null;
  return { level: "team", unitId: teamId };
}

export function useDashboardScope(): DashboardScope {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const org = useOrgStructure();

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const tab = parseTab(params.get("tab"));
  const rawLevel = parseLevel(params.get("level"));
  const rawUnitId = params.get("id");

  // Validate the unit id against the org store; if invalid, drop it.
  const { level, unitId } = useMemo(() => {
    if (rawLevel === "global") return { level: "global" as const, unitId: null };
    if (rawLevel === "bu") {
      const exists = org.businessUnits.some((b) => b.id === rawUnitId);
      return {
        level: "bu" as const,
        unitId: exists ? rawUnitId! : org.businessUnits[0]?.id ?? null,
      };
    }
    if (rawLevel === "dept") {
      const exists = org.departments.some((d) => d.id === rawUnitId);
      return {
        level: "dept" as const,
        unitId: exists ? rawUnitId! : org.departments[0]?.id ?? null,
      };
    }
    // team
    const exists = org.teams.some((t) => t.id === rawUnitId);
    return {
      level: "team" as const,
      unitId: exists ? rawUnitId! : org.teams[0]?.id ?? null,
    };
  }, [rawLevel, rawUnitId, org]);

  const updateUrl = useCallback(
    (next: { tab?: DashboardTab; level?: ScopeLevel; unitId?: string | null }) => {
      const newParams = new URLSearchParams(params);
      if (next.tab !== undefined) newParams.set("tab", next.tab);
      if (next.level !== undefined) {
        newParams.set("level", next.level);
        if (next.level === "global") {
          newParams.delete("id");
        }
      }
      if (next.unitId !== undefined) {
        if (next.unitId === null) newParams.delete("id");
        else newParams.set("id", next.unitId);
      }
      const qs = newParams.toString();
      setLocation(`/dashboard${qs ? `?${qs}` : ""}`, { replace: true });
    },
    [params, setLocation]
  );

  const setTab = useCallback(
    (next: DashboardTab) => updateUrl({ tab: next }),
    [updateUrl]
  );

  const setScope = useCallback(
    (nextLevel: ScopeLevel, nextUnitId?: string | null) => {
      if (nextLevel === "global") {
        updateUrl({ level: "global", unitId: null });
        return;
      }
      if (nextUnitId !== undefined) {
        // Direct selection of a unit at the given level
        updateUrl({ level: nextLevel, unitId: nextUnitId });
        return;
      }
      // Granularity switch — try to keep the parent
      const reparented = computeReparent(level, unitId, nextLevel, org);
      updateUrl({ level: reparented.level, unitId: reparented.unitId });
    },
    [updateUrl, level, unitId, org]
  );

  // Resolve unit object + label
  const unit = useMemo<BusinessUnit | Department | Team | null>(() => {
    if (level === "global") return null;
    if (level === "bu") return org.businessUnits.find((b) => b.id === unitId) ?? null;
    if (level === "dept") return org.departments.find((d) => d.id === unitId) ?? null;
    return org.teams.find((t) => t.id === unitId) ?? null;
  }, [level, unitId, org]);

  const unitName = unit?.name ?? null;

  const unitLabel = useMemo(() => {
    if (level === "global") return "All organization";
    if (!unit) return "—";
    if (level === "bu") return `${unit.name} BU`;
    if (level === "dept") return `${unit.name} dept`;
    return `${unit.name} team`;
  }, [level, unit]);

  const scopeLabel = useMemo(() => {
    if (level === "global") return "all departments";
    if (!unit) return "—";
    if (level === "bu") return `${unit.name} BU`;
    if (level === "dept") return `${unit.name} dept`;
    return `${unit.name} team`;
  }, [level, unit]);

  // Build dropdown options for the active level
  const unitOptions = useMemo(() => {
    if (level === "global") return [];
    if (level === "bu") {
      return org.businessUnits.map((b) => ({ value: b.id, label: b.name }));
    }
    if (level === "dept") {
      return org.departments.map((d) => {
        const bu = org.businessUnits.find((b) => b.id === d.buId);
        return {
          value: d.id,
          label: bu ? `${d.name} · ${bu.name}` : d.name,
        };
      });
    }
    return org.teams.map((t) => {
      const dept = org.departments.find((d) => d.id === t.departmentId);
      return {
        value: t.id,
        label: dept ? `${t.name} · ${dept.name}` : t.name,
      };
    });
  }, [level, org]);

  // Filter employees by the active scope
  const scopedEmployees = useMemo(() => {
    if (level === "global" || !unit) return employees;

    if (level === "bu") {
      // Department names that belong to this BU
      const deptNames = new Set(
        org.departments.filter((d) => d.buId === unit.id).map((d) => d.name)
      );
      // Match by employee buId (canonical) OR department-name fallback when
      // the org structure holds a department under this BU but the employee's
      // buId isn't perfectly aligned with the latest mapping.
      return employees.filter(
        (e) => e.buId === unit.id || deptNames.has(e.department)
      );
    }

    if (level === "dept") {
      const dept = unit as Department;
      return employees.filter((e) => e.department === dept.name);
    }

    // team
    const team = unit as Team;
    const dept = org.departments.find((d) => d.id === team.departmentId);
    if (!dept) return [];
    return employees.filter(
      (e) =>
        e.department === dept.name &&
        employeeExtras[e.id]?.team === team.name
    );
  }, [level, unit, org]);

  const scopedLeaveRequests = useMemo(() => {
    if (level === "global") return leaveRequests;
    const ids = new Set(scopedEmployees.map((e) => e.id));
    return leaveRequests.filter((r) => ids.has(r.employeeId));
  }, [level, scopedEmployees]);

  return {
    level,
    unitId,
    unit,
    unitName,
    unitLabel,
    scopeLabel,
    scopedEmployees,
    scopedLeaveRequests,
    setScope,
    tab,
    setTab,
    unitOptions,
  };
}
