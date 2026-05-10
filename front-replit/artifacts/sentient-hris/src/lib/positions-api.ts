import type {
  Skill,
  PositionSkill,
  Position,
  PositionLevel,
  SkillGapItem,
  SkillsGapResult,
  RequirementLevel,
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

export async function getSkillsGap(employeeId: string): Promise<SkillsGapResult | null> {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/skills-gap`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch skills gap");
  const json = await res.json();
  const d = json.data;
  return {
    employeeId: d.employeeId,
    positionId: d.positionId,
    positionTitle: d.position?.title as string | undefined,
    items: d.items as SkillGapItem[],
    summary: d.summary as { met: number; partial: number; exceeds: number },
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
