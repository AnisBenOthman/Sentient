import { useEffect, useSyncExternalStore } from "react";
import {
  buLabels,
  departments as seedDepartments,
  employees as seedEmployees,
  employeeExtras as seedEmployeeExtras,
} from "./mock-data";

// v3: Team names updated to realistic per-dept names (HR Business Partners,
// Talent Acquisition, Backend Engineering, Platform & Infrastructure, etc.).
// Bumping the key forces the seed to be rebuilt from fresh mock data.
const STORAGE_KEY = "hris_org_structure_v3";

export type BusinessUnit = { id: string; name: string };
export type Department = { id: string; name: string; buId: string };
export type Team = { id: string; name: string; departmentId: string };

export type OrgStructure = {
  businessUnits: BusinessUnit[];
  departments: Department[];
  teams: Team[];
};

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildSeed(): OrgStructure {
  const businessUnits: BusinessUnit[] = Object.entries(buLabels).map(
    ([id, name]) => ({ id, name })
  );

  const buIds = new Set(businessUnits.map((bu) => bu.id));
  const fallbackBuId = businessUnits[0]?.id ?? "";

  // Walk employees and bucket each (department, buId) pair so we can create
  // one Department record per location — same function in two BUs becomes two
  // separate Departments (e.g. Engineering in Seattle vs. Engineering in
  // Bengaluru). This mirrors the org-structure model documented in the
  // Settings page.
  const deptBuPairs = new Map<string, { name: string; buId: string }>();
  for (const emp of seedEmployees) {
    if (!emp.department || !emp.buId) continue;
    if (!buIds.has(emp.buId)) continue;
    const key = `${emp.department}::${emp.buId}`;
    if (!deptBuPairs.has(key)) {
      deptBuPairs.set(key, { name: emp.department, buId: emp.buId });
    }
  }

  // For department names that exist in the catalog but aren't linked to any
  // employee (e.g. seeded Sales/Design with no current staff), fall back to
  // the first BU so they still appear under some location.
  const namesWithEmployees = new Set(
    Array.from(deptBuPairs.values()).map((p) => p.name)
  );
  const departments: Department[] = Array.from(deptBuPairs.values()).map(
    (p) => ({
      id: genId("dept"),
      name: p.name,
      buId: p.buId,
    })
  );
  if (fallbackBuId) {
    for (const d of seedDepartments) {
      if (namesWithEmployees.has(d.name)) continue;
      departments.push({
        id: d.id,
        name: d.name,
        buId: fallbackBuId,
      });
    }
  }

  // Build teams keyed by (employee's resolved department row, team name) so a
  // team belonging to Engineering-Seattle is distinct from a same-named team
  // under Engineering-Bengaluru.
  const deptByNameBu = new Map(
    departments.map((d) => [`${d.name}::${d.buId}`, d])
  );
  const teamMap = new Map<string, Team>();
  for (const empId of Object.keys(seedEmployeeExtras)) {
    const extra = seedEmployeeExtras[empId];
    const emp = seedEmployees.find((e) => e.id === empId);
    if (!emp || !extra.team) continue;
    const dept =
      deptByNameBu.get(`${emp.department}::${emp.buId}`) ??
      departments.find((d) => d.name === emp.department);
    if (!dept) continue;
    const key = `${dept.id}::${extra.team}`;
    if (!teamMap.has(key)) {
      teamMap.set(key, {
        id: genId("t"),
        name: extra.team,
        departmentId: dept.id,
      });
    }
  }

  return {
    businessUnits,
    departments,
    teams: Array.from(teamMap.values()),
  };
}

function safeRead(): OrgStructure {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeed();
    const parsed = JSON.parse(raw) as Partial<OrgStructure> | null;
    if (
      !parsed ||
      !Array.isArray(parsed.businessUnits) ||
      !Array.isArray(parsed.departments) ||
      !Array.isArray(parsed.teams)
    ) {
      return buildSeed();
    }
    return {
      businessUnits: parsed.businessUnits as BusinessUnit[],
      departments: parsed.departments as Department[],
      teams: parsed.teams as Team[],
    };
  } catch {
    return buildSeed();
  }
}

let cache: OrgStructure | null = null;
const listeners = new Set<() => void>();

function getState(): OrgStructure {
  if (!cache) {
    cache = safeRead();
    persist(cache);
  }
  return cache;
}

function persist(state: OrgStructure) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function setState(updater: (prev: OrgStructure) => OrgStructure) {
  const prev = getState();
  const next = updater(prev);
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function trimmedNonEmpty(name: string): string {
  return name.trim();
}

function nameExists(
  list: Array<{ name: string; id: string }>,
  name: string,
  excludeId?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  return list.some(
    (item) => item.name.trim().toLowerCase() === normalized && item.id !== excludeId
  );
}

export type OrgStructureMutationError = string;

// ---------- Business Units ----------

export function addBusinessUnit(name: string): OrgStructureMutationError | null {
  const trimmed = trimmedNonEmpty(name);
  if (!trimmed) return "Name is required";
  const state = getState();
  if (nameExists(state.businessUnits, trimmed)) {
    return "A Business Unit with that name already exists";
  }
  setState((prev) => ({
    ...prev,
    businessUnits: [...prev.businessUnits, { id: genId("bu"), name: trimmed }],
  }));
  return null;
}

export function renameBusinessUnit(
  id: string,
  name: string
): OrgStructureMutationError | null {
  const trimmed = trimmedNonEmpty(name);
  if (!trimmed) return "Name is required";
  const state = getState();
  if (nameExists(state.businessUnits, trimmed, id)) {
    return "A Business Unit with that name already exists";
  }
  setState((prev) => ({
    ...prev,
    businessUnits: prev.businessUnits.map((bu) =>
      bu.id === id ? { ...bu, name: trimmed } : bu
    ),
  }));
  return null;
}

export function deleteBusinessUnit(id: string) {
  setState((prev) => {
    const removedDeptIds = prev.departments
      .filter((d) => d.buId === id)
      .map((d) => d.id);
    return {
      businessUnits: prev.businessUnits.filter((bu) => bu.id !== id),
      departments: prev.departments.filter((d) => d.buId !== id),
      teams: prev.teams.filter((t) => !removedDeptIds.includes(t.departmentId)),
    };
  });
}

export function getBusinessUnitChildCounts(id: string): {
  departments: number;
  teams: number;
} {
  const state = getState();
  const deptIds = new Set(
    state.departments.filter((d) => d.buId === id).map((d) => d.id)
  );
  const teams = state.teams.filter((t) => deptIds.has(t.departmentId)).length;
  return { departments: deptIds.size, teams };
}

// ---------- Departments ----------

export function addDepartment(
  name: string,
  buId: string
): OrgStructureMutationError | null {
  const trimmed = trimmedNonEmpty(name);
  if (!trimmed) return "Name is required";
  if (!buId) return "Business Unit is required";
  const state = getState();
  if (!state.businessUnits.some((bu) => bu.id === buId)) {
    return "Selected Business Unit no longer exists";
  }
  const siblings = state.departments.filter((d) => d.buId === buId);
  if (nameExists(siblings, trimmed)) {
    return "A Department with that name already exists in this Business Unit";
  }
  setState((prev) => ({
    ...prev,
    departments: [
      ...prev.departments,
      { id: genId("dept"), name: trimmed, buId },
    ],
  }));
  return null;
}

export function updateDepartment(
  id: string,
  patch: { name?: string; buId?: string }
): OrgStructureMutationError | null {
  const state = getState();
  const existing = state.departments.find((d) => d.id === id);
  if (!existing) return "Department not found";
  const nextName = patch.name !== undefined ? trimmedNonEmpty(patch.name) : existing.name;
  const nextBuId = patch.buId ?? existing.buId;
  if (!nextName) return "Name is required";
  if (!nextBuId) return "Business Unit is required";
  if (!state.businessUnits.some((bu) => bu.id === nextBuId)) {
    return "Selected Business Unit no longer exists";
  }
  const siblings = state.departments.filter(
    (d) => d.buId === nextBuId && d.id !== id
  );
  if (nameExists(siblings, nextName)) {
    return "A Department with that name already exists in this Business Unit";
  }
  setState((prev) => ({
    ...prev,
    departments: prev.departments.map((d) =>
      d.id === id ? { ...d, name: nextName, buId: nextBuId } : d
    ),
  }));
  return null;
}

export function deleteDepartment(id: string) {
  setState((prev) => ({
    ...prev,
    departments: prev.departments.filter((d) => d.id !== id),
    teams: prev.teams.filter((t) => t.departmentId !== id),
  }));
}

export function getDepartmentChildCounts(id: string): { teams: number } {
  const state = getState();
  return {
    teams: state.teams.filter((t) => t.departmentId === id).length,
  };
}

// ---------- Teams ----------

export function addTeam(
  name: string,
  departmentId: string
): OrgStructureMutationError | null {
  const trimmed = trimmedNonEmpty(name);
  if (!trimmed) return "Name is required";
  if (!departmentId) return "Department is required";
  const state = getState();
  if (!state.departments.some((d) => d.id === departmentId)) {
    return "Selected Department no longer exists";
  }
  const siblings = state.teams.filter((t) => t.departmentId === departmentId);
  if (nameExists(siblings, trimmed)) {
    return "A Team with that name already exists in this Department";
  }
  setState((prev) => ({
    ...prev,
    teams: [...prev.teams, { id: genId("team"), name: trimmed, departmentId }],
  }));
  return null;
}

export function updateTeam(
  id: string,
  patch: { name?: string; departmentId?: string }
): OrgStructureMutationError | null {
  const state = getState();
  const existing = state.teams.find((t) => t.id === id);
  if (!existing) return "Team not found";
  const nextName = patch.name !== undefined ? trimmedNonEmpty(patch.name) : existing.name;
  const nextDeptId = patch.departmentId ?? existing.departmentId;
  if (!nextName) return "Name is required";
  if (!nextDeptId) return "Department is required";
  if (!state.departments.some((d) => d.id === nextDeptId)) {
    return "Selected Department no longer exists";
  }
  const siblings = state.teams.filter(
    (t) => t.departmentId === nextDeptId && t.id !== id
  );
  if (nameExists(siblings, nextName)) {
    return "A Team with that name already exists in this Department";
  }
  setState((prev) => ({
    ...prev,
    teams: prev.teams.map((t) =>
      t.id === id ? { ...t, name: nextName, departmentId: nextDeptId } : t
    ),
  }));
  return null;
}

export function deleteTeam(id: string) {
  setState((prev) => ({
    ...prev,
    teams: prev.teams.filter((t) => t.id !== id),
  }));
}

// ---------- Subscriptions / Hooks ----------

export function getOrgStructure(): OrgStructure {
  return getState();
}

export function useOrgStructure(): OrgStructure {
  const state = useSyncExternalStore(
    subscribe,
    getState,
    getState
  );
  return state;
}

export function useDepartmentNames(): string[] {
  const { departments } = useOrgStructure();
  const names = departments.map((d) => d.name);
  // Stable sort alphabetical for nicer dropdowns
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

// Convenience: ensure store is hydrated on mount (used when component
// only needs to read once and doesn't subscribe).
export function useEnsureOrgStructure() {
  useEffect(() => {
    getState();
  }, []);
}
