import { randomUUID } from "crypto";

type DepartmentFixture = {
  id: string;
  name: string;
  code: string;
  description: string;
  headId: string | null;
  isActive: boolean;
};

type TeamFixture = {
  id: string;
  name: string;
  code: string | null;
  description: string;
  departmentId: string;
  leadId: string | null;
  projectFocus: string | null;
  isActive: boolean;
};

type PositionFixture = {
  id: string;
  title: string;
  level: string | null;
  isActive: boolean;
};

export function buildDepartment(
  overrides: Partial<DepartmentFixture> = {},
): DepartmentFixture {
  const id = randomUUID();

  return {
    id,
    name: "Engineering",
    code: `ENG-${id.slice(0, 4).toUpperCase()}`,
    description: "Default department fixture",
    headId: null,
    isActive: true,
    ...overrides,
  };
}

export function buildTeam(overrides: Partial<TeamFixture> = {}): TeamFixture {
  const id = randomUUID();

  return {
    id,
    name: "Backend",
    code: `BE-${id.slice(0, 4).toUpperCase()}`,
    description: "Default team fixture",
    departmentId: randomUUID(),
    leadId: null,
    projectFocus: null,
    isActive: true,
    ...overrides,
  };
}

export function buildPosition(
  overrides: Partial<PositionFixture> = {},
): PositionFixture {
  const id = randomUUID();

  return {
    id,
    title: `Software Engineer - ${id.slice(0, 4).toUpperCase()}`,
    level: "Senior",
    isActive: true,
    ...overrides,
  };
}
