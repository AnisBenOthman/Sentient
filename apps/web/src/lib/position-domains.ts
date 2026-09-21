import type { Position } from "@/lib/api/hr-core";

export type PositionDomain = "ENGINEERING" | "PRODUCT_DESIGN" | "HR" | "FINANCE" | "SALES" | "OTHER";

/**
 * WHY no label/description here: those are copy, and copy is translated. They
 * live in the `positions` locale namespace under `domains.<value>`, so this
 * module stays pure routing data. `match` stays here because it is matched
 * against position titles as stored, not against anything the user reads.
 */
export const POSITION_DOMAINS: Array<{
  value: PositionDomain;
  match: RegExp;
}> = [
  { value: "ENGINEERING", match: /(engineer|technical lead|software|frontend)/i },
  { value: "PRODUCT_DESIGN", match: /(product|ux|designer|design)/i },
  { value: "HR", match: /\bhr\b|human resources|people|recruit/i },
  { value: "FINANCE", match: /(finance|financial|accountant|controller|fp&a|accounting)/i },
  { value: "SALES", match: /(sales|account executive|\bae\b)/i },
  { value: "OTHER", match: /.^/ },
];

export const POSITION_LEVEL_RANK: Record<string, number> = {
  JUNIOR: 0,
  MEDIUM: 1,
  CONFIRMED: 2,
  SENIOR_1: 3,
  SENIOR_2: 4,
  EXPERT: 5,
};

export function getPositionDomain(position: Position): PositionDomain {
  return POSITION_DOMAINS.find((domain) => domain.match.test(position.title))?.value ?? "OTHER";
}

export function sortPositionsByLevelThenTitle(a: Position, b: Position): number {
  const rankA = a.level ? (POSITION_LEVEL_RANK[a.level] ?? 99) : 99;
  const rankB = b.level ? (POSITION_LEVEL_RANK[b.level] ?? 99) : 99;
  if (rankA !== rankB) return rankA - rankB;
  return a.title.localeCompare(b.title);
}
