import type {
  Skill,
  PositionSkill,
  Position,
  PositionLevel,
  SkillGapItem,
  SkillsGapResult,
  RequirementLevel,
} from "./mock-data";
import {
  defaultPositionSkills,
  employeePositionIds,
  employees,
  positions,
} from "./mock-data";

const API_BASE = "/api";

// ── Typed API wrappers ────────────────────────────────────────────────────────

export async function getSkills(): Promise<Skill[]> {
  const res = await fetch(`${API_BASE}/skills`);
  if (!res.ok) throw new Error("Failed to fetch skills");
  const json = await res.json();
  return json.data as Skill[];
}

export interface PositionWithCount extends Position {
  skillCount: number;
}

export async function getPositions(): Promise<PositionWithCount[]> {
  const res = await fetch(`${API_BASE}/positions`);
  if (!res.ok) throw new Error("Failed to fetch positions");
  const json = await res.json();
  return json.data as PositionWithCount[];
}

export async function getPositionSkills(positionId: string): Promise<PositionSkill[]> {
  const res = await fetch(`${API_BASE}/positions/${positionId}/skills`);
  if (!res.ok) throw new Error("Failed to fetch position skills");
  const json = await res.json();
  return json.data as PositionSkill[];
}

export async function bulkReplacePositionSkills(
  positionId: string,
  skillList: Array<{
    skillId: string;
    proficiency: number;
    requirementLevel: RequirementLevel;
  }>
): Promise<PositionSkill[]> {
  const res = await fetch(`${API_BASE}/positions/${positionId}/skills`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skillList),
  });
  if (!res.ok) throw new Error("Failed to save position skills");
  const json = await res.json();
  return json.data as PositionSkill[];
}

export async function deletePositionSkill(
  positionId: string,
  skillId: string
): Promise<PositionSkill[]> {
  const res = await fetch(`${API_BASE}/positions/${positionId}/skills/${skillId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete position skill");
  const json = await res.json();
  return json.data as PositionSkill[];
}

export async function getSkillsGap(
  employeeId: string,
  employeeSkills?: Array<{ skill: string; level: number }>
): Promise<SkillsGapResult | null> {
  const fallback = buildLocalSkillsGap(employeeId, employeeSkills);

  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}/skills-gap`);
    if (res.status === 404) return fallback;
    if (!res.ok) return fallback;
    const json = await res.json();
    const d = json.data;
    return {
      employeeId: d.employeeId,
      positionId: d.positionId,
      positionTitle: d.position?.title as string | undefined,
      items: d.items as SkillGapItem[],
      summary: d.summary as { met: number; partial: number; exceeds: number },
    };
  } catch {
    return fallback;
  }
}

export function buildLocalSkillsGap(
  employeeId: string,
  employeeSkills?: Array<{ skill: string; level: number }>
): SkillsGapResult | null {
  const positionId = employeePositionIds[employeeId];
  if (!positionId) return null;

  const position = positions.find((item) => item.id === positionId);
  if (!position) return null;

  const requiredSkills = defaultPositionSkills[positionId] ?? [];
  if (requiredSkills.length === 0) return null;

  const employee = employees.find((item) => item.id === employeeId);
  const acquiredSkills = employeeSkills ?? employee?.skills ?? [];
  const acquiredByName = new Map(acquiredSkills.map((item) => [item.skill, item.level]));

  const items: SkillGapItem[] = requiredSkills.map((item) => {
    const acquiredProficiency = acquiredByName.get(item.skill.name) ?? null;
    const status: SkillGapItem["status"] =
      acquiredProficiency === null
        ? "MISSING"
        : acquiredProficiency > item.proficiency
          ? "EXCEEDS"
          : acquiredProficiency === item.proficiency
            ? "MET"
            : "PARTIAL";

    return {
      skill: item.skill,
      requiredProficiency: item.proficiency,
      requirementLevel: item.requirementLevel,
      acquiredProficiency,
      status,
    };
  });

  const met = items.filter((item) => item.status === "MET" || item.status === "EXCEEDS").length;
  const partial = items.filter((item) => item.status === "PARTIAL" || item.status === "MISSING").length;
  const exceeds = items.filter((item) => item.status === "EXCEEDS").length;

  return {
    employeeId,
    positionId,
    positionTitle: position.title,
    items,
    summary: { met, partial, exceeds },
  };
}

export async function getEmployeePositionId(employeeId: string): Promise<string | null> {
  const gap = await getSkillsGap(employeeId).catch(() => null);
  return gap?.positionId ?? null;
}

export interface PositionInput {
  title: string;
  level: PositionLevel;
  isActive?: boolean;
  isKeyPosition?: boolean;
}

export async function createPosition(input: PositionInput): Promise<PositionWithCount> {
  const res = await fetch(`${API_BASE}/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create position" }));
    throw new Error(err.error ?? "Failed to create position");
  }
  const json = await res.json();
  return json.data as PositionWithCount;
}

export async function updatePosition(
  positionId: string,
  patch: Partial<PositionInput>
): Promise<PositionWithCount> {
  const res = await fetch(`${API_BASE}/positions/${positionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update position" }));
    throw new Error(err.error ?? "Failed to update position");
  }
  const json = await res.json();
  return json.data as PositionWithCount;
}

export async function deletePosition(positionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/positions/${positionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete position");
}
