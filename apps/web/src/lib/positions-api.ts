import {
  createPosition as createBackendPosition,
  deactivatePosition,
  deletePositionSkill as deleteBackendPositionSkill,
  getPositionSkills as getBackendPositionSkills,
  getPositions as getBackendPositions,
  getSkillsCatalog,
  getSkillsGap as getBackendSkillsGap,
  replacePositionSkills,
  updatePosition as updateBackendPosition,
  type Position,
  type PositionSkill,
  type PositionSkillPayload,
  type SkillRef,
  type SkillsGapResult,
} from "./api/hr-core";
import type { PositionLevel } from "./mock-data";

// ── Typed API wrappers ────────────────────────────────────────────────────────

export async function getSkills(): Promise<SkillRef[]> {
  const catalog = await getSkillsCatalog();
  return catalog.data;
}

export interface PositionWithCount extends Position {
  skillCount?: number;
  department?: string | null;
  team?: string | null;
}

export async function getPositions(): Promise<PositionWithCount[]> {
  return getBackendPositions();
}

export async function getPositionSkills(positionId: string): Promise<PositionSkill[]> {
  return getBackendPositionSkills(positionId);
}

export async function bulkReplacePositionSkills(
  positionId: string,
  skills: PositionSkillPayload[],
): Promise<PositionSkill[]> {
  return replacePositionSkills(positionId, skills);
}

export async function deletePositionSkill(
  positionId: string,
  skillId: string
): Promise<void> {
  await deleteBackendPositionSkill(positionId, skillId);
}

export async function getSkillsGap(employeeId: string): Promise<SkillsGapResult | null> {
  return getBackendSkillsGap(employeeId);
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
  return createBackendPosition(input);
}

export async function updatePosition(
  positionId: string,
  patch: Partial<PositionInput>
): Promise<PositionWithCount> {
  return updateBackendPosition(positionId, patch);
}

export async function deletePosition(positionId: string): Promise<void> {
  await deactivatePosition(positionId);
}
