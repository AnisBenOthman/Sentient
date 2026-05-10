import path from "node:path";
import fs from "node:fs";
import vm from "node:vm";
import * as argon2 from "argon2";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import ts from "typescript";
import {
  AccrualFrequency,
  ContractType,
  EducationLevel,
  EmploymentStatus,
  KeyPositionRisk,
  LeaveStatus,
  MaritalStatus,
  PermissionScope,
  PerformanceRating,
  PerformanceReviewAuditAction,
  PositionLevel,
  Prisma,
  PrismaClient,
  ProficiencyLevel,
  ReviewCycleStatus,
  ReviewStatus,
  ReviewType,
  SalaryChangeReason,
  SatisfactionLevel,
  SkillDomain,
  SkillRequirementLevel,
  SourceLevel,
  UserStatus,
} from "../src/generated/prisma";

loadEnv({ path: path.join(__dirname, "..", ".env") });

const adapter = new PrismaPg({ connectionString: process.env["HR_CORE_DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

type MockEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  hireDate: string;
  salary: number;
  managerId: string | null;
  buId: string;
  skills: Array<{ skill: string; level: number }>;
};

type MockEmployeeExtra = {
  employeeCode: string;
  phone: string;
  dateOfBirth: string;
  contractType: string;
  netSalary: number;
  maritalStatus: string;
  educationLevel: string;
  educationField: string;
  positionLevel: string;
  isKeyPosition: boolean;
  team: string;
};

type MockSkill = {
  id: string;
  name: string;
  category: string;
};

type MockPosition = {
  id: string;
  title: string;
  level: string;
  isActive: boolean;
  isKeyPosition: boolean;
  department: string;
  team: string;
};

type MockPositionSkill = {
  skillId: string;
  skill: MockSkill;
  proficiency: number;
  requirementLevel: string;
};

type MockSalaryEntry = {
  effectiveDate: string;
  previousGross: number;
  newGross: number;
  raisePercentage: number;
  reason: string;
  comment: string;
};

type MockSkillSnapshot = {
  date: string;
  label: string;
  skills: Record<string, number>;
};

type MockLeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "Annual" | "Sick" | "Personal";
  startDate: string;
  endDate: string;
  status: string;
  daysCount: number;
};

type ReplitMockData = {
  buLabels: Record<string, string>;
  defaultPositionSkills: Record<string, MockPositionSkill[]>;
  departmentSkills: Record<string, string[]>;
  employeeExtras: Record<string, MockEmployeeExtra>;
  employeePositionIds: Record<string, string>;
  employees: MockEmployee[];
  leaveRequests: MockLeaveRequest[];
  positions: MockPosition[];
  salaryHistory: Record<string, MockSalaryEntry[]>;
  skillHistory: Record<string, MockSkillSnapshot[]>;
  skills: MockSkill[];
};

function loadReplitMockData(): ReplitMockData {
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "front-replit",
    "artifacts",
    "sentient-hris",
    "src",
    "lib",
    "mock-data.ts",
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
    },
  });
  const exportsObject: Record<string, unknown> = {};
  vm.runInNewContext(transpiled.outputText, {
    exports: exportsObject,
    module: { exports: exportsObject },
    console,
  });
  return exportsObject as unknown as ReplitMockData;
}

const {
  buLabels,
  defaultPositionSkills,
  departmentSkills,
  employeeExtras,
  employeePositionIds,
  employees,
  leaveRequests,
  positions,
  salaryHistory,
  skillHistory,
  skills,
} = loadReplitMockData();

const IMPORT_TAG = "replit-mock";
const IMPORT_CHANGED_BY = "seed-replit";
const DEMO_PASSWORD = "Sentient@2026!";

const leaveTypeByMockType = {
  Annual: {
    name: "Annual Leave",
    defaultDaysPerYear: 24,
    accrualFrequency: AccrualFrequency.MONTHLY,
    maxCarryoverDays: 5,
    color: "#4CAF50",
  },
  Sick: {
    name: "Sick Leave",
    defaultDaysPerYear: 12,
    accrualFrequency: AccrualFrequency.MONTHLY,
    maxCarryoverDays: 0,
    color: "#F44336",
  },
  Personal: {
    name: "Personal Leave",
    defaultDaysPerYear: 5,
    accrualFrequency: AccrualFrequency.YEARLY,
    maxCarryoverDays: 0,
    color: "#9C27B0",
  },
} as const;

function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? name;
  const lastName = parts.length > 0 ? parts.join(" ") : ".";
  return { firstName, lastName };
}

function codePart(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("-");

  return normalized.length > 0 ? normalized.slice(0, 24) : fallback;
}

function departmentCode(name: string, buId: string): string {
  return `${codePart(name, "DEPT")}-${codePart(buId, "BU")}`.slice(0, 48);
}

function teamCode(name: string, departmentName: string, buId: string): string {
  return `${codePart(departmentName, "DEP")}-${codePart(name, "TEAM")}-${codePart(buId, "BU")}`.slice(0, 64);
}

function skillCategory(skill: MockSkill): string {
  const readable = skill.category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${IMPORT_TAG}: ${readable}`;
}

function skillDomain(skill: MockSkill): SkillDomain | null {
  switch (skill.category) {
    case "TECHNICAL":  return SkillDomain.TECHNICAL;
    case "LEADERSHIP": return SkillDomain.LEADERSHIP;
    case "BEHAVIORAL": return SkillDomain.SOFT_SKILLS;
    case "DOMAIN":     return SkillDomain.DOMAIN_EXPERTISE;
    default:           return null;
  }
}

function statusFromMock(status: string): EmploymentStatus {
  if (status === "on-leave") return EmploymentStatus.ON_LEAVE;
  if (status === "probation") return EmploymentStatus.PROBATION;
  if (status === "terminated") return EmploymentStatus.TERMINATED;
  if (status === "resigned") return EmploymentStatus.RESIGNED;
  return EmploymentStatus.ACTIVE;
}

function proficiencyFromNumber(level: number): ProficiencyLevel {
  if (level <= 1) return ProficiencyLevel.BEGINNER;
  if (level === 2) return ProficiencyLevel.INTERMEDIATE;
  if (level === 3) return ProficiencyLevel.ADVANCED;
  return ProficiencyLevel.EXPERT;
}

function leaveStatusFromMock(status: string): LeaveStatus {
  if (status === "Approved") return LeaveStatus.APPROVED;
  if (status === "Rejected") return LeaveStatus.REJECTED;
  if (status === "Cancelled") return LeaveStatus.CANCELLED;
  return LeaveStatus.PENDING;
}

function positionLevel(level: string | undefined): PositionLevel | undefined {
  if (!level) return undefined;
  return PositionLevel[level as keyof typeof PositionLevel];
}

function salaryReason(reason: string): SalaryChangeReason {
  return SalaryChangeReason[reason as keyof typeof SalaryChangeReason] ?? SalaryChangeReason.OTHER;
}

function requirementLevel(level: string): SkillRequirementLevel {
  return (
    SkillRequirementLevel[level as keyof typeof SkillRequirementLevel] ??
    SkillRequirementLevel.MANDATORY
  );
}

async function resolveEmployeeCode(email: string, preferredCode: string): Promise<string> {
  const existing = await prisma.employee.findUnique({
    where: { employeeCode: preferredCode },
    select: { email: true },
  });

  if (!existing || existing.email === email) return preferredCode;

  return `RPL-${preferredCode.replace(/^EMP-?/, "").padStart(3, "0")}`;
}

async function seedBusinessUnits(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [mockId, name] of Object.entries(buLabels)) {
    const bu = await prisma.businessUnit.upsert({
      where: { name },
      update: {},
      create: {
        name,
        address: `${name} office`,
      },
    });
    ids.set(mockId, bu.id);
  }

  return ids;
}

function collectDepartmentPairs(): Array<{ name: string; buMockId: string }> {
  const pairs = new Map<string, { name: string; buMockId: string }>();

  for (const employee of employees) {
    const key = `${employee.department}::${employee.buId}`;
    pairs.set(key, { name: employee.department, buMockId: employee.buId });
  }

  return Array.from(pairs.values());
}

async function seedDepartments(
  businessUnitIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const pair of collectDepartmentPairs()) {
    const businessUnitId = businessUnitIds.get(pair.buMockId);
    if (!businessUnitId) continue;

    const code = departmentCode(pair.name, pair.buMockId);
    const department = await prisma.department.upsert({
      where: { code_businessUnitId: { code, businessUnitId } },
      update: {
        name: pair.name,
        description: `${IMPORT_TAG} department`,
      },
      create: {
        name: pair.name,
        code,
        description: `${IMPORT_TAG} department`,
        businessUnitId,
      },
    });
    ids.set(`${pair.name}::${pair.buMockId}`, department.id);
  }

  return ids;
}

async function seedTeams(
  businessUnitIds: Map<string, string>,
  departmentIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const teamPairs = new Map<
    string,
    { name: string; departmentName: string; buMockId: string; departmentId: string; businessUnitId: string }
  >();

  for (const employee of employees) {
    const extra = employeeExtras[employee.id];
    if (!extra?.team) continue;

    const departmentId = departmentIds.get(`${employee.department}::${employee.buId}`);
    const businessUnitId = businessUnitIds.get(employee.buId);
    if (!departmentId || !businessUnitId) continue;

    const key = `${extra.team}::${employee.department}::${employee.buId}`;
    teamPairs.set(key, {
      name: extra.team,
      departmentName: employee.department,
      buMockId: employee.buId,
      departmentId,
      businessUnitId,
    });
  }

  for (const pair of teamPairs.values()) {
    const code = teamCode(pair.name, pair.departmentName, pair.buMockId);
    const team = await prisma.team.upsert({
      where: { code_businessUnitId: { code, businessUnitId: pair.businessUnitId } },
      update: {
        name: pair.name,
        departmentId: pair.departmentId,
        projectFocus: IMPORT_TAG,
      },
      create: {
        name: pair.name,
        code,
        description: `${IMPORT_TAG} team`,
        departmentId: pair.departmentId,
        businessUnitId: pair.businessUnitId,
        projectFocus: IMPORT_TAG,
      },
    });
    ids.set(`${pair.name}::${pair.departmentName}::${pair.buMockId}`, team.id);
  }

  return ids;
}

async function seedSkills(): Promise<Map<string, string>> {
  const allNames = new Map<string, string | undefined>();

  for (const skill of skills) allNames.set(skill.name, skillCategory(skill));
  for (const employee of employees) {
    for (const skill of employee.skills) allNames.set(skill.skill, allNames.get(skill.skill));
  }
  for (const skillNames of Object.values(departmentSkills)) {
    for (const name of skillNames) allNames.set(name, allNames.get(name));
  }
  for (const snapshots of Object.values(skillHistory)) {
    for (const snapshot of snapshots) {
      for (const name of Object.keys(snapshot.skills)) allNames.set(name, allNames.get(name));
    }
  }

  const domainByName = new Map<string, SkillDomain | null>();
  for (const skill of skills) domainByName.set(skill.name, skillDomain(skill));

  const ids = new Map<string, string>();
  for (const [name, category] of allNames) {
    const domain = domainByName.get(name) ?? null;
    const skill = await prisma.skill.upsert({
      where: { name },
      update: { ...(category ? { category } : {}), ...(domain ? { domain } : {}) },
      create: {
        name,
        category: category ?? `${IMPORT_TAG}: General`,
        ...(domain ? { domain } : {}),
      },
    });
    ids.set(name, skill.id);
  }

  return ids;
}

async function seedPositions(skillIds: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const position of positions) {
    const saved = await prisma.position.upsert({
      where: { title: position.title },
      update: {
        level: positionLevel(position.level),
        isActive: position.isActive,
        isKeyPosition: position.isKeyPosition,
        keyPositionRisk: position.isKeyPosition ? KeyPositionRisk.MEDIUM : null,
      },
      create: {
        title: position.title,
        level: positionLevel(position.level),
        isActive: position.isActive,
        isKeyPosition: position.isKeyPosition,
        keyPositionRisk: position.isKeyPosition ? KeyPositionRisk.MEDIUM : null,
      },
    });
    ids.set(position.id, saved.id);
  }

  for (const [mockPositionId, requiredSkills] of Object.entries(defaultPositionSkills)) {
    const positionId = ids.get(mockPositionId);
    if (!positionId) continue;

    for (const required of requiredSkills) {
      const skillId = skillIds.get(required.skill.name);
      if (!skillId) continue;

      await prisma.positionSkill.upsert({
        where: { positionId_skillId: { positionId, skillId } },
        update: {
          minimumProficiency: proficiencyFromNumber(required.proficiency),
          requirementLevel: requirementLevel(required.requirementLevel),
        },
        create: {
          positionId,
          skillId,
          minimumProficiency: proficiencyFromNumber(required.proficiency),
          requirementLevel: requirementLevel(required.requirementLevel),
        },
      });
    }
  }

  return ids;
}

function employeeTeamId(
  employee: MockEmployee,
  teamIds: Map<string, string>,
): string | null {
  const extra = employeeExtras[employee.id];
  if (!extra?.team) return null;
  return teamIds.get(`${extra.team}::${employee.department}::${employee.buId}`) ?? null;
}

async function seedEmployees(
  departmentIds: Map<string, string>,
  teamIds: Map<string, string>,
  positionIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const employee of employees) {
    const extra = employeeExtras[employee.id];
    const name = splitName(employee.name);
    const employeeCode = await resolveEmployeeCode(
      employee.email,
      extra?.employeeCode ?? `RPL-${employee.id.padStart(3, "0")}`,
    );
    const mockPositionId = employeePositionIds[employee.id];

    const saved = await prisma.employee.upsert({
      where: { email: employee.email },
      update: {
        employeeCode,
        firstName: name.firstName,
        lastName: name.lastName,
        phone: extra?.phone ?? null,
        dateOfBirth: extra?.dateOfBirth ? asDate(extra.dateOfBirth) : null,
        hireDate: asDate(employee.hireDate),
        employmentStatus: statusFromMock(employee.status),
        contractType: extra?.contractType
          ? ContractType[extra.contractType as keyof typeof ContractType]
          : ContractType.FULL_TIME,
        grossSalary: new Prisma.Decimal(employee.salary),
        netSalary: new Prisma.Decimal(extra?.netSalary ?? Math.round(employee.salary * 0.76)),
        maritalStatus: extra?.maritalStatus
          ? MaritalStatus[extra.maritalStatus as keyof typeof MaritalStatus]
          : null,
        educationLevel: extra?.educationLevel
          ? EducationLevel[extra.educationLevel as keyof typeof EducationLevel]
          : null,
        educationField: extra?.educationField ?? null,
        positionId: mockPositionId ? positionIds.get(mockPositionId) ?? null : null,
        departmentId: departmentIds.get(`${employee.department}::${employee.buId}`) ?? null,
        teamId: employeeTeamId(employee, teamIds),
      },
      create: {
        employeeCode,
        firstName: name.firstName,
        lastName: name.lastName,
        email: employee.email,
        phone: extra?.phone ?? null,
        dateOfBirth: extra?.dateOfBirth ? asDate(extra.dateOfBirth) : null,
        hireDate: asDate(employee.hireDate),
        employmentStatus: statusFromMock(employee.status),
        contractType: extra?.contractType
          ? ContractType[extra.contractType as keyof typeof ContractType]
          : ContractType.FULL_TIME,
        grossSalary: new Prisma.Decimal(employee.salary),
        netSalary: new Prisma.Decimal(extra?.netSalary ?? Math.round(employee.salary * 0.76)),
        maritalStatus: extra?.maritalStatus
          ? MaritalStatus[extra.maritalStatus as keyof typeof MaritalStatus]
          : null,
        educationLevel: extra?.educationLevel
          ? EducationLevel[extra.educationLevel as keyof typeof EducationLevel]
          : null,
        educationField: extra?.educationField ?? null,
        positionId: mockPositionId ? positionIds.get(mockPositionId) ?? null : null,
        departmentId: departmentIds.get(`${employee.department}::${employee.buId}`) ?? null,
        teamId: employeeTeamId(employee, teamIds),
      },
    });

    ids.set(employee.id, saved.id);
  }

  for (const employee of employees) {
    const id = ids.get(employee.id);
    const fallbackManagerId = employee.id === "0" ? null : ids.get("0") ?? null;
    const managerId = employee.managerId ? ids.get(employee.managerId) ?? fallbackManagerId : fallbackManagerId;
    if (!id) continue;
    await prisma.employee.update({
      where: { id },
      data: { managerId },
    });
  }

  await seedTeamLeads(ids);
  await seedOrgLeaders();

  return ids;
}

async function seedTeamLeads(employeeIds: Map<string, string>): Promise<void> {
  for (const employee of employees) {
    const employeeId = employeeIds.get(employee.id);
    if (!employeeId) continue;

    const directReports = employees.filter((candidate) => candidate.managerId === employee.id);
    if (directReports.length === 0) continue;

    const teamIds = new Set<string>();
    for (const report of directReports) {
      const saved = await prisma.employee.findUnique({
        where: { id: employeeIds.get(report.id) ?? "" },
        select: { teamId: true },
      });
      if (saved?.teamId) teamIds.add(saved.teamId);
    }

    for (const teamId of teamIds) {
      await prisma.team.update({
        where: { id: teamId },
        data: { leadId: employeeId },
      });
    }
  }
}

async function seedOrgLeaders(): Promise<void> {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      leadId: true,
      employees: {
        where: { deletedAt: null },
        select: { id: true, managerId: true },
        orderBy: [{ managerId: "asc" }, { hireDate: "asc" }],
      },
    },
  });

  for (const team of teams) {
    const leadInTeam = team.employees.some((employee) => employee.id === team.leadId);
    if (leadInTeam || !team.employees[0]) continue;
    await prisma.team.update({
      where: { id: team.id },
      data: { leadId: team.employees[0].id },
    });
  }

  const departments = await prisma.department.findMany({
    select: {
      id: true,
      headId: true,
      employees: {
        where: { deletedAt: null },
        select: { id: true, managerId: true },
        orderBy: [{ managerId: "asc" }, { hireDate: "asc" }],
      },
    },
  });

  for (const department of departments) {
    const headInDepartment = department.employees.some((employee) => employee.id === department.headId);
    if (headInDepartment || !department.employees[0]) continue;
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: department.employees[0].id },
    });
  }
}

async function resetDemoHrData(): Promise<void> {
  await prisma.user.updateMany({ data: { employeeId: null } });
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalanceAdjustment.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.skillHistory.deleteMany();
  await prisma.employeeSkill.deleteMany();
  await prisma.positionSkill.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.team.deleteMany();
  await prisma.department.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.position.deleteMany();
  await prisma.skill.deleteMany();
}

async function ensureDemoRoles(): Promise<Map<string, string>> {
  const roles = [
    { code: "EMPLOYEE", name: "Employee", isSystem: true, isEditable: true },
    { code: "MANAGER", name: "Manager", isSystem: true, isEditable: true },
    { code: "HR_ADMIN", name: "HR Administrator", isSystem: true, isEditable: true },
    { code: "EXECUTIVE", name: "Executive", isSystem: true, isEditable: true },
    { code: "GLOBAL_HR_ADMIN", name: "Global HR Admin", isSystem: true, isEditable: true },
    { code: "SYSTEM_ADMIN", name: "System Admin", isSystem: true, isEditable: false },
  ];

  const ids = new Map<string, string>();
  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, isEditable: role.isEditable },
      create: role,
    });
    ids.set(role.code, saved.id);
  }
  return ids;
}

async function upsertDemoUser(
  email: string,
  roleId: string,
  scope: PermissionScope,
  scopeEntityId: string | null,
  employeeId: string | null,
  passwordHash: string,
): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      passwordHistory: [passwordHash],
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      employeeId,
    },
    create: {
      email,
      passwordHash,
      passwordHistory: [passwordHash],
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      employeeId,
    },
  });

  await prisma.userRole.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.userRole.create({
    data: { userId: user.id, roleId, scope, scopeEntityId },
  });
}

async function linkDemoUsers(): Promise<void> {
  const roleIds = await ensureDemoRoles();
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const topEmployee = await prisma.employee.findFirst({
    where: { managerId: null, deletedAt: null },
    select: { id: true },
    orderBy: { hireDate: "asc" },
  });
  const team = await prisma.team.findFirst({
    where: { leadId: { not: null } },
    select: { id: true, leadId: true, departmentId: true },
    orderBy: { name: "asc" },
  });
  const department = await prisma.department.findFirst({
    where: { headId: { not: null } },
    select: { id: true, headId: true },
    orderBy: { name: "asc" },
  });
  const managerEmployee = await prisma.employee.findFirst({
    where: {
      deletedAt: null,
      departmentId: department?.id,
      id: { notIn: [topEmployee?.id, team?.leadId].filter(Boolean) as string[] },
    },
    select: { id: true },
    orderBy: { hireDate: "asc" },
  });
  const employee = await prisma.employee.findFirst({
    where: {
      deletedAt: null,
      id: { notIn: [topEmployee?.id, team?.leadId, managerEmployee?.id].filter(Boolean) as string[] },
    },
    select: { id: true },
    orderBy: { hireDate: "desc" },
  });

  await upsertDemoUser(
    "hradmin@sentient.dev",
    roleIds.get("HR_ADMIN") ?? "",
    PermissionScope.GLOBAL,
    null,
    topEmployee?.id ?? null,
    passwordHash,
  );
  await upsertDemoUser(
    "teamlead@sentient.dev",
    roleIds.get("MANAGER") ?? "",
    PermissionScope.TEAM,
    team?.id ?? null,
    team?.leadId ?? null,
    passwordHash,
  );
  await upsertDemoUser(
    "manager@sentient.dev",
    roleIds.get("MANAGER") ?? "",
    PermissionScope.DEPARTMENT,
    department?.id ?? team?.departmentId ?? null,
    managerEmployee?.id ?? department?.headId ?? null,
    passwordHash,
  );
  await upsertDemoUser(
    "employee@sentient.dev",
    roleIds.get("EMPLOYEE") ?? "",
    PermissionScope.OWN,
    null,
    employee?.id ?? null,
    passwordHash,
  );
}

async function seedPerformanceReviewEnumMeta(): Promise<void> {
  const entries: Array<{ enumName: string; key: string; rank: number; label: string }> = [
    { enumName: "SatisfactionLevel", key: SatisfactionLevel.VERY_DISSATISFIED, rank: 1, label: "Very dissatisfied" },
    { enumName: "SatisfactionLevel", key: SatisfactionLevel.DISSATISFIED, rank: 2, label: "Dissatisfied" },
    { enumName: "SatisfactionLevel", key: SatisfactionLevel.NEUTRAL, rank: 3, label: "Neutral" },
    { enumName: "SatisfactionLevel", key: SatisfactionLevel.SATISFIED, rank: 4, label: "Satisfied" },
    { enumName: "SatisfactionLevel", key: SatisfactionLevel.VERY_SATISFIED, rank: 5, label: "Very satisfied" },
    { enumName: "PerformanceRating", key: PerformanceRating.UNACCEPTABLE, rank: 1, label: "Unacceptable" },
    { enumName: "PerformanceRating", key: PerformanceRating.NEEDS_IMPROVEMENT, rank: 2, label: "Needs improvement" },
    { enumName: "PerformanceRating", key: PerformanceRating.MEETS_EXPECTATIONS, rank: 3, label: "Meets expectations" },
    { enumName: "PerformanceRating", key: PerformanceRating.EXCEEDS_EXPECTATIONS, rank: 4, label: "Exceeds expectations" },
    { enumName: "PerformanceRating", key: PerformanceRating.ABOVE_AND_BEYOND, rank: 5, label: "Above and beyond" },
    { enumName: "ReviewStatus", key: ReviewStatus.PENDING, rank: 1, label: "Pending" },
    { enumName: "ReviewStatus", key: ReviewStatus.IN_PROGRESS, rank: 2, label: "In progress" },
    { enumName: "ReviewStatus", key: ReviewStatus.SUBMITTED, rank: 3, label: "Submitted" },
    { enumName: "ReviewStatus", key: ReviewStatus.COMPLETED, rank: 4, label: "Completed" },
    { enumName: "ReviewStatus", key: ReviewStatus.REOPENED, rank: 5, label: "Reopened" },
    { enumName: "ReviewStatus", key: ReviewStatus.CLOSED, rank: 6, label: "Closed" },
    { enumName: "ReviewStatus", key: ReviewStatus.CANCELLED, rank: 7, label: "Cancelled" },
    { enumName: "ReviewType", key: ReviewType.ANNUAL, rank: 1, label: "Annual" },
    { enumName: "ReviewType", key: ReviewType.MID_YEAR, rank: 2, label: "Mid-year" },
    { enumName: "ReviewType", key: ReviewType.PROBATION, rank: 3, label: "Probation" },
    { enumName: "ReviewCycleStatus", key: ReviewCycleStatus.DRAFT, rank: 1, label: "Draft" },
    { enumName: "ReviewCycleStatus", key: ReviewCycleStatus.ACTIVE, rank: 2, label: "Active" },
    { enumName: "ReviewCycleStatus", key: ReviewCycleStatus.CLOSED, rank: 3, label: "Closed" },
    { enumName: "ReviewCycleStatus", key: ReviewCycleStatus.CANCELLED, rank: 4, label: "Cancelled" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.CYCLE_CREATED, rank: 1, label: "Cycle created" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.ASSIGNED, rank: 2, label: "Assigned" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.SELF_SUBMITTED, rank: 3, label: "Self submitted" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.MANAGER_COMPLETED, rank: 4, label: "Manager completed" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.REVIEWER_REASSIGNED, rank: 5, label: "Reviewer reassigned" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.REOPENED, rank: 6, label: "Reopened" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.CLOSED, rank: 7, label: "Closed" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.CANCELLED, rank: 8, label: "Cancelled" },
    { enumName: "PerformanceReviewAuditAction", key: PerformanceReviewAuditAction.SALARY_FOLLOW_UP_RECORDED, rank: 9, label: "Salary follow-up recorded" },
  ];

  for (const entry of entries) {
    await prisma.enumMeta.upsert({
      where: { enumName_key: { enumName: entry.enumName, key: entry.key } },
      update: { rank: entry.rank, label: entry.label },
      create: entry,
    });
  }
}

async function seedEmployeeSkills(
  employeeIds: Map<string, string>,
  skillIds: Map<string, string>,
): Promise<void> {
  for (const employee of employees) {
    const employeeId = employeeIds.get(employee.id);
    if (!employeeId) continue;

    for (const employeeSkill of employee.skills) {
      const skillId = skillIds.get(employeeSkill.skill);
      if (!skillId) continue;

      const existing = await prisma.employeeSkill.findFirst({
        where: { employeeId, skillId, deletedAt: null },
        select: { id: true },
      });

      const data = {
        proficiency: proficiencyFromNumber(employeeSkill.level),
        acquiredDate: asDate(employee.hireDate),
      };

      if (existing) {
        await prisma.employeeSkill.update({ where: { id: existing.id }, data });
      } else {
        await prisma.employeeSkill.create({ data: { employeeId, skillId, ...data } });
      }
    }
  }
}

async function seedSalaryHistory(employeeIds: Map<string, string>): Promise<void> {
  for (const [mockEmployeeId, entries] of Object.entries(salaryHistory)) {
    const employeeId = employeeIds.get(mockEmployeeId);
    if (!employeeId) continue;

    for (const entry of entries) {
      const effectiveDate = asDate(entry.effectiveDate);
      const existing = await prisma.salaryHistory.findFirst({
        where: {
          employeeId,
          effectiveDate,
          previousGrossSalary: new Prisma.Decimal(entry.previousGross),
          newGrossSalary: new Prisma.Decimal(entry.newGross),
        },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.salaryHistory.create({
        data: {
          employeeId,
          previousGrossSalary: new Prisma.Decimal(entry.previousGross),
          newGrossSalary: new Prisma.Decimal(entry.newGross),
          previousNetSalary: new Prisma.Decimal(Math.round(entry.previousGross * 0.76)),
          newNetSalary: new Prisma.Decimal(Math.round(entry.newGross * 0.76)),
          grossRaisePercentage: new Prisma.Decimal(entry.raisePercentage),
          reason: salaryReason(entry.reason),
          reasonComment: entry.comment,
          effectiveDate,
          changedById: IMPORT_CHANGED_BY,
        },
      });
    }
  }
}

async function seedSkillHistory(
  employeeIds: Map<string, string>,
  skillIds: Map<string, string>,
): Promise<void> {
  for (const [mockEmployeeId, snapshots] of Object.entries(skillHistory)) {
    const employeeId = employeeIds.get(mockEmployeeId);
    if (!employeeId) continue;

    const previousLevels = new Map<string, ProficiencyLevel | null>();
    for (const snapshot of snapshots) {
      const effectiveDate = asDate(snapshot.date);
      for (const [skillName, level] of Object.entries(snapshot.skills)) {
        const skillId = skillIds.get(skillName);
        if (!skillId) continue;

        const newLevel = proficiencyFromNumber(level);
        const previousLevel = previousLevels.get(skillId) ?? null;
        const existing = await prisma.skillHistory.findFirst({
          where: {
            employeeId,
            skillId,
            effectiveDate,
            newLevel,
            source: SourceLevel.MANAGER,
          },
          select: { id: true },
        });

        if (!existing) {
          await prisma.skillHistory.create({
            data: {
              employeeId,
              skillId,
              previousLevel,
              newLevel,
              effectiveDate,
              source: SourceLevel.MANAGER,
              note: `${IMPORT_TAG}: ${snapshot.label}`,
            },
          });
        }

        previousLevels.set(skillId, newLevel);
      }
    }
  }
}

async function seedLeaveTypes(businessUnitIds: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [mockBuId, businessUnitId] of businessUnitIds) {
    for (const [mockType, leaveType] of Object.entries(leaveTypeByMockType)) {
      const saved = await prisma.leaveType.upsert({
        where: { name_businessUnitId: { name: leaveType.name, businessUnitId } },
        update: {
          defaultDaysPerYear: new Prisma.Decimal(leaveType.defaultDaysPerYear),
          accrualFrequency: leaveType.accrualFrequency,
          maxCarryoverDays: new Prisma.Decimal(leaveType.maxCarryoverDays),
          requiresApproval: true,
          color: leaveType.color,
        },
        create: {
          businessUnitId,
          name: leaveType.name,
          defaultDaysPerYear: new Prisma.Decimal(leaveType.defaultDaysPerYear),
          accrualFrequency: leaveType.accrualFrequency,
          maxCarryoverDays: new Prisma.Decimal(leaveType.maxCarryoverDays),
          requiresApproval: true,
          color: leaveType.color,
        },
      });
      ids.set(`${mockBuId}::${mockType}`, saved.id);
    }
  }

  return ids;
}

async function seedLeaveRequestsAndBalances(
  employeeIds: Map<string, string>,
  leaveTypeIds: Map<string, string>,
): Promise<void> {
  const balanceUsage = new Map<string, { usedDays: number; pendingDays: number }>();

  for (const request of leaveRequests) {
    const mockEmployee = employees.find((employee) => employee.id === request.employeeId);
    const employeeId = employeeIds.get(request.employeeId);
    if (!mockEmployee || !employeeId) continue;

    const leaveTypeId = leaveTypeIds.get(`${mockEmployee.buId}::${request.type}`);
    if (!leaveTypeId) continue;

    const startDate = asDate(request.startDate);
    const endDate = asDate(request.endDate);
    const status = leaveStatusFromMock(request.status);
    const existing = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        totalDays: new Prisma.Decimal(request.daysCount),
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.leaveRequest.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      await prisma.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId,
          startDate,
          endDate,
          totalDays: new Prisma.Decimal(request.daysCount),
          status,
          reason: `${IMPORT_TAG}: ${request.type}`,
          reviewedAt: status === LeaveStatus.PENDING ? null : new Date("2024-04-01T00:00:00.000Z"),
        },
      });
    }

    const key = `${employeeId}::${leaveTypeId}::${startDate.getUTCFullYear()}`;
    const current = balanceUsage.get(key) ?? { usedDays: 0, pendingDays: 0 };
    if (status === LeaveStatus.APPROVED) current.usedDays += request.daysCount;
    if (status === LeaveStatus.PENDING) current.pendingDays += request.daysCount;
    balanceUsage.set(key, current);
  }

  await seedLeaveBalances(employeeIds, leaveTypeIds, balanceUsage);
}

async function seedLeaveBalances(
  employeeIds: Map<string, string>,
  leaveTypeIds: Map<string, string>,
  balanceUsage: Map<string, { usedDays: number; pendingDays: number }>,
): Promise<void> {
  const years = [2024, 2025, 2026];

  for (const employee of employees) {
    const employeeId = employeeIds.get(employee.id);
    if (!employeeId) continue;

    for (const mockType of Object.keys(leaveTypeByMockType) as Array<keyof typeof leaveTypeByMockType>) {
      const leaveTypeId = leaveTypeIds.get(`${employee.buId}::${mockType}`);
      if (!leaveTypeId) continue;

      const config = leaveTypeByMockType[mockType];
      for (const year of years) {
        const usage = balanceUsage.get(`${employeeId}::${leaveTypeId}::${year}`) ?? {
          usedDays: 0,
          pendingDays: 0,
        };

        await prisma.leaveBalance.upsert({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
          update: {
            totalDays: new Prisma.Decimal(config.defaultDaysPerYear),
            usedDays: new Prisma.Decimal(usage.usedDays),
            pendingDays: new Prisma.Decimal(usage.pendingDays),
          },
          create: {
            employeeId,
            leaveTypeId,
            year,
            totalDays: new Prisma.Decimal(config.defaultDaysPerYear),
            usedDays: new Prisma.Decimal(usage.usedDays),
            pendingDays: new Prisma.Decimal(usage.pendingDays),
          },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  await resetDemoHrData();
  const businessUnitIds = await seedBusinessUnits();
  const departmentIds = await seedDepartments(businessUnitIds);
  const teamIds = await seedTeams(businessUnitIds, departmentIds);
  const skillIds = await seedSkills();
  const positionIds = await seedPositions(skillIds);
  const employeeIds = await seedEmployees(departmentIds, teamIds, positionIds);
  await seedEmployeeSkills(employeeIds, skillIds);
  await seedSalaryHistory(employeeIds);
  await seedSkillHistory(employeeIds, skillIds);
  const leaveTypeIds = await seedLeaveTypes(businessUnitIds);
  await seedLeaveRequestsAndBalances(employeeIds, leaveTypeIds);
  await seedPerformanceReviewEnumMeta();
  await linkDemoUsers();

  console.log(
    `Imported ${employeeIds.size} Replit employees, ${businessUnitIds.size} business units, ${skillIds.size} skills.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
