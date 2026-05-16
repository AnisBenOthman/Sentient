import type { Position } from "@/lib/api/hr-core";

export type PositionDomain = "ENGINEERING" | "PRODUCT_DESIGN" | "HR" | "FINANCE" | "SALES" | "OTHER";

export const POSITION_DOMAINS: Array<{
  value: PositionDomain;
  label: string;
  description: string;
  match: RegExp;
}> = [
  {
    value: "ENGINEERING",
    label: "Engineering",
    description: "Software, frontend, technical lead, and engineering management roles",
    match: /(engineer|technical lead|software|frontend)/i,
  },
  {
    value: "PRODUCT_DESIGN",
    label: "Product & Design",
    description: "Product ownership, product management, UX, and design positions",
    match: /(product|ux|designer|design)/i,
  },
  {
    value: "HR",
    label: "Human Resources",
    description: "HR partner and people operations positions",
    match: /\bhr\b|human resources|people|recruit/i,
  },
  {
    value: "FINANCE",
    label: "Finance",
    description: "Accounting, controlling, FP&A, and finance leadership positions",
    match: /(finance|financial|accountant|controller|fp&a|accounting)/i,
  },
  {
    value: "SALES",
    label: "Sales",
    description: "Sales leadership and account executive positions",
    match: /(sales|account executive|\bae\b)/i,
  },
  {
    value: "OTHER",
    label: "Other Positions",
    description: "Positions without a seeded job-family match",
    match: /.^/,
  },
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
