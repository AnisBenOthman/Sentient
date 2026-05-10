import path from "node:path";
import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import * as argon2 from "argon2";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccrualFrequency,
  LeaveStatus,
  Prisma,
  PermissionAction,
  PermissionScope,
  PositionLevel,
  PrismaClient,
  ProficiencyLevel,
  SalaryChangeReason,
  SourceLevel,
  UserStatus,
} from "../src/generated/prisma";

loadEnv({ path: path.join(__dirname, "..", ".env") });

const adapter = new PrismaPg({ connectionString: process.env["HR_CORE_DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  await seedIam();

  // BusinessUnit must exist before departments (FK constraint).
  const bu = await prisma.businessUnit.upsert({
    where:  { name: "Sentient HQ" },
    update: {},
    create: { name: "Sentient HQ", address: "Algiers, Algeria" },
  });

  // Departments — unique per (name, businessUnitId).
  await prisma.department.createMany({
    data: [
      { name: "Engineering",    code: "ENG", description: "Engineering department", businessUnitId: bu.id },
      { name: "Human Resources", code: "HR",  description: "People operations",      businessUnitId: bu.id },
      { name: "Product",        code: "PRD", description: "Product management",      businessUnitId: bu.id },
    ],
    skipDuplicates: true,
  });

  await prisma.position.createMany({
    data: [
      { title: "Software Engineer - Junior",   level: PositionLevel.JUNIOR    },
      { title: "Software Engineer - Senior I", level: PositionLevel.SENIOR_1  },
      { title: "HR Generalist",                level: PositionLevel.CONFIRMED },
      { title: "Product Manager",              level: PositionLevel.CONFIRMED },
      { title: "DevOps Engineer",              level: PositionLevel.MEDIUM    },
    ],
    skipDuplicates: true,
  });

  const departments = await prisma.department.findMany({
    where:  { code: { in: ["ENG", "HR", "PRD"] }, businessUnitId: bu.id },
    select: { id: true, code: true, businessUnitId: true },
  });

  const byCode = new Map(departments.map((d) => [d.code, d.id]));

  await prisma.team.createMany({
    data: [
      { name: "Backend",              code: "ENG-BE", departmentId: byCode.get("ENG") ?? "", businessUnitId: bu.id },
      { name: "Frontend",             code: "ENG-FE", departmentId: byCode.get("ENG") ?? "", businessUnitId: bu.id },
      { name: "Talent Acquisition",   code: "HR-TA",  departmentId: byCode.get("HR")  ?? "", businessUnitId: bu.id },
      { name: "Learning & Development", code: "HR-LD", departmentId: byCode.get("HR") ?? "", businessUnitId: bu.id },
      { name: "Product Strategy",     code: "PRD-PS", departmentId: byCode.get("PRD") ?? "", businessUnitId: bu.id },
      { name: "Product Design",       code: "PRD-DS", departmentId: byCode.get("PRD") ?? "", businessUnitId: bu.id },
    ].filter((t) => Boolean(t.departmentId)),
    skipDuplicates: true,
  });

  // Skill catalog — upsert by name so the seed is safe to re-run.
  const catalogSkills = [
    { name: "React",         category: "Frontend"    },
    { name: "TypeScript",    category: "Programming" },
    { name: "PostgreSQL",    category: "Database"    },
    { name: "Docker",        category: "DevOps"      },
    { name: "Kubernetes",    category: "DevOps"      },
    { name: "English",       category: "Language"    },
    { name: "French",        category: "Language"    },
    { name: "Arabic",        category: "Language"    },
    { name: "Communication", category: "Soft Skills" },
    { name: "Leadership",    category: "Soft Skills" },
  ];

  for (const skill of catalogSkills) {
    await prisma.skill.upsert({
      where:  { name: skill.name },
      update: {},
      create: skill,
    });
  }

  // ================================================================
  // Leave Types — one catalog per BusinessUnit, idempotent upsert
  // ================================================================
  const allBUs = await prisma.businessUnit.findMany({ where: { isActive: true } });
  for (const businessUnit of allBUs) {
    const leaveTypeSeed = [
      { name: "Annual Leave",     defaultDaysPerYear: 24, accrualFrequency: AccrualFrequency.MONTHLY, maxCarryoverDays: 5,  requiresApproval: true,  color: "#4CAF50" },
      { name: "Sick Leave",       defaultDaysPerYear: 12, accrualFrequency: AccrualFrequency.MONTHLY, maxCarryoverDays: 0,  requiresApproval: true,  color: "#F44336" },
      { name: "Maternity Leave",  defaultDaysPerYear: 98, accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0,  requiresApproval: true,  color: "#E91E63" },
      { name: "Paternity Leave",  defaultDaysPerYear: 3,  accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0,  requiresApproval: true,  color: "#2196F3" },
      { name: "Unpaid Leave",     defaultDaysPerYear: 0,  accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0,  requiresApproval: true,  color: "#9E9E9E" },
    ];
    for (const lt of leaveTypeSeed) {
      await prisma.leaveType.upsert({
        where: { name_businessUnitId: { name: lt.name, businessUnitId: businessUnit.id } },
        update: {},
        create: { ...lt, businessUnitId: businessUnit.id },
      });
    }

    // ================================================================
    // Holidays — 2026 Algerian public holidays per BusinessUnit
    // ================================================================
    const holidays2026 = [
      { name: "New Year's Day",              date: "2026-01-01", isRecurring: false, year: 2026 },
      { name: "Yennayer (Amazigh New Year)", date: "2026-01-12", isRecurring: false, year: 2026 },
      { name: "Labour Day",                  date: "2026-05-01", isRecurring: false, year: 2026 },
      { name: "Independence Day",            date: "2026-07-05", isRecurring: false, year: 2026 },
      { name: "Revolution Day",              date: "2026-11-01", isRecurring: false, year: 2026 },
      { name: "Eid al-Fitr (approx.)",       date: "2026-03-20", isRecurring: false, year: 2026 },
      { name: "Eid al-Adha (approx.)",       date: "2026-05-27", isRecurring: false, year: 2026 },
      { name: "Mawlid al-Nabi (approx.)",    date: "2026-09-15", isRecurring: false, year: 2026 },
    ];
    for (const h of holidays2026) {
      await prisma.holiday.upsert({
        where: { date_businessUnitId_year: { date: new Date(h.date + "T00:00:00.000Z"), businessUnitId: businessUnit.id, year: h.year } },
        update: {},
        create: {
          businessUnitId: businessUnit.id,
          name: h.name,
          date: new Date(h.date + "T00:00:00.000Z"),
          isRecurring: h.isRecurring,
          year: h.year,
        },
      });
    }
  }

  // EnumMeta for ordered dropdowns and numeric comparison.
  await prisma.enumMeta.createMany({
    data: [
      { enumName: "PositionLevel", key: "JUNIOR",        rank: 0, label: "Junior"        },
      { enumName: "PositionLevel", key: "MEDIUM",        rank: 1, label: "Medium"        },
      { enumName: "PositionLevel", key: "CONFIRMED",     rank: 2, label: "Confirmed"     },
      { enumName: "PositionLevel", key: "SENIOR_1",      rank: 3, label: "Senior I"      },
      { enumName: "PositionLevel", key: "SENIOR_2",      rank: 4, label: "Senior II"     },
      { enumName: "PositionLevel", key: "EXPERT",        rank: 5, label: "Expert"        },
      { enumName: "EducationLevel", key: "BELOW_COLLEGE", rank: 1, label: "Below College" },
      { enumName: "EducationLevel", key: "COLLEGE",       rank: 2, label: "College"       },
      { enumName: "EducationLevel", key: "BACHELOR",      rank: 3, label: "Bachelor"      },
      { enumName: "EducationLevel", key: "MASTER",        rank: 4, label: "Master"        },
      { enumName: "EducationLevel", key: "DOCTOR",        rank: 5, label: "Doctor"        },
      { enumName: "MaritalStatus",  key: "SINGLE",        rank: 0, label: "Single"        },
      { enumName: "MaritalStatus",  key: "MARRIED",       rank: 1, label: "Married"       },
      { enumName: "MaritalStatus",  key: "DIVORCED",      rank: 2, label: "Divorced"      },
      { enumName: "MaritalStatus",  key: "WIDOWED",       rank: 3, label: "Widowed"       },
      { enumName: "SalaryChangeReason", key: "PROMOTION",     rank: 0, label: "Promotion"     },
      { enumName: "SalaryChangeReason", key: "ANNUAL_REVIEW", rank: 1, label: "Annual Review" },
      { enumName: "SalaryChangeReason", key: "NEW_FUNCTION",  rank: 2, label: "New Function"  },
      { enumName: "SalaryChangeReason", key: "OTHER",         rank: 3, label: "Other"          },
    ],
    skipDuplicates: true,
  });

  await seedDemoUsers();
  await seedDemoEmployees();
  await seedGlobalOrg();
}

async function seedIam(): Promise<void> {
  // ── Permissions ────────────────────────────────────────────────────────────
  const permDefs: { resource: string; action: PermissionAction; scope: PermissionScope }[] = [
    // Employee
    { resource: "employee", action: PermissionAction.READ,   scope: PermissionScope.OWN           },
    { resource: "employee", action: PermissionAction.READ,   scope: PermissionScope.TEAM          },
    { resource: "employee", action: PermissionAction.READ,   scope: PermissionScope.DEPARTMENT    },
    { resource: "employee", action: PermissionAction.READ,   scope: PermissionScope.BUSINESS_UNIT },
    { resource: "employee", action: PermissionAction.READ,   scope: PermissionScope.GLOBAL        },
    { resource: "employee", action: PermissionAction.CREATE, scope: PermissionScope.BUSINESS_UNIT },
    { resource: "employee", action: PermissionAction.CREATE, scope: PermissionScope.GLOBAL        },
    { resource: "employee", action: PermissionAction.UPDATE, scope: PermissionScope.OWN           },
    { resource: "employee", action: PermissionAction.UPDATE, scope: PermissionScope.BUSINESS_UNIT },
    { resource: "employee", action: PermissionAction.UPDATE, scope: PermissionScope.GLOBAL        },
    { resource: "employee", action: PermissionAction.DELETE, scope: PermissionScope.BUSINESS_UNIT },
    // Leave Request
    { resource: "leave_request", action: PermissionAction.CREATE, scope: PermissionScope.OWN           },
    { resource: "leave_request", action: PermissionAction.READ,   scope: PermissionScope.OWN           },
    { resource: "leave_request", action: PermissionAction.READ,   scope: PermissionScope.TEAM          },
    { resource: "leave_request", action: PermissionAction.READ,   scope: PermissionScope.BUSINESS_UNIT },
    { resource: "leave_request", action: PermissionAction.READ,   scope: PermissionScope.GLOBAL        },
    { resource: "leave_request", action: PermissionAction.DELETE, scope: PermissionScope.OWN           },
    { resource: "leave_request", action: PermissionAction.APPROVE,scope: PermissionScope.TEAM          },
    { resource: "leave_request", action: PermissionAction.APPROVE,scope: PermissionScope.BUSINESS_UNIT },
    { resource: "leave_request", action: PermissionAction.APPROVE,scope: PermissionScope.GLOBAL        },
    // Leave Balance
    { resource: "leave_balance", action: PermissionAction.READ,   scope: PermissionScope.OWN           },
    { resource: "leave_balance", action: PermissionAction.READ,   scope: PermissionScope.TEAM          },
    { resource: "leave_balance", action: PermissionAction.READ,   scope: PermissionScope.BUSINESS_UNIT },
    { resource: "leave_balance", action: PermissionAction.UPDATE, scope: PermissionScope.BUSINESS_UNIT },
    // Skill
    { resource: "skill", action: PermissionAction.READ,   scope: PermissionScope.OWN           },
    { resource: "skill", action: PermissionAction.CREATE, scope: PermissionScope.OWN           },
    { resource: "skill", action: PermissionAction.UPDATE, scope: PermissionScope.OWN           },
    { resource: "skill", action: PermissionAction.READ,   scope: PermissionScope.TEAM          },
    { resource: "skill", action: PermissionAction.READ,   scope: PermissionScope.BUSINESS_UNIT },
    // User management
    { resource: "user", action: PermissionAction.CREATE, scope: PermissionScope.BUSINESS_UNIT },
    { resource: "user", action: PermissionAction.CREATE, scope: PermissionScope.GLOBAL        },
    { resource: "user", action: PermissionAction.READ,   scope: PermissionScope.BUSINESS_UNIT },
    { resource: "user", action: PermissionAction.READ,   scope: PermissionScope.GLOBAL        },
    { resource: "user", action: PermissionAction.UPDATE, scope: PermissionScope.BUSINESS_UNIT },
    { resource: "user", action: PermissionAction.UPDATE, scope: PermissionScope.GLOBAL        },
    { resource: "user", action: PermissionAction.DELETE, scope: PermissionScope.GLOBAL        },
    // Role catalog
    { resource: "role", action: PermissionAction.CREATE, scope: PermissionScope.GLOBAL },
    { resource: "role", action: PermissionAction.READ,   scope: PermissionScope.GLOBAL },
    { resource: "role", action: PermissionAction.UPDATE, scope: PermissionScope.GLOBAL },
    { resource: "role", action: PermissionAction.DELETE, scope: PermissionScope.GLOBAL },
    // Audit
    { resource: "audit_log", action: PermissionAction.READ, scope: PermissionScope.GLOBAL },
    // Salary
    { resource: "salary_history", action: PermissionAction.READ, scope: PermissionScope.BUSINESS_UNIT },
    { resource: "salary_history", action: PermissionAction.READ, scope: PermissionScope.GLOBAL        },
  ];

  for (const p of permDefs) {
    await prisma.permission.upsert({
      where: { resource_action_scope: p },
      update: {},
      create: p,
    });
  }

  const allPerms = await prisma.permission.findMany();
  const perm = (res: string, act: PermissionAction, scp: PermissionScope) =>
    allPerms.find((p) => p.resource === res && p.action === act && p.scope === scp);

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleDefs = [
    { code: "EMPLOYEE",       name: "Employee",          isSystem: true, isEditable: true  },
    { code: "MANAGER",        name: "Manager",           isSystem: true, isEditable: true  },
    { code: "HR_ADMIN",       name: "HR Administrator",  isSystem: true, isEditable: true  },
    { code: "EXECUTIVE",      name: "Executive",         isSystem: true, isEditable: true  },
    { code: "GLOBAL_HR_ADMIN",name: "Global HR Admin",   isSystem: true, isEditable: true  },
    { code: "SYSTEM_ADMIN",   name: "System Admin",      isSystem: true, isEditable: false },
    { code: "SYSTEM",         name: "System",            isSystem: true, isEditable: false },
  ];

  for (const r of roleDefs) {
    await prisma.role.upsert({
      where:  { code: r.code },
      update: { name: r.name, isEditable: r.isEditable },
      create: r,
    });
  }

  const roles = await prisma.role.findMany();
  const role = (code: string) => roles.find((r) => r.code === code)!;

  // ── Role → Permissions mapping ─────────────────────────────────────────────
  const rolePermMap: { roleCode: string; perms: (typeof allPerms[number] | undefined)[] }[] = [
    {
      roleCode: "EMPLOYEE",
      perms: [
        perm("employee", PermissionAction.READ, PermissionScope.OWN),
        perm("leave_request", PermissionAction.CREATE, PermissionScope.OWN),
        perm("leave_request", PermissionAction.READ, PermissionScope.OWN),
        perm("leave_request", PermissionAction.DELETE, PermissionScope.OWN),
        perm("leave_balance", PermissionAction.READ, PermissionScope.OWN),
        perm("skill", PermissionAction.READ, PermissionScope.OWN),
        perm("skill", PermissionAction.CREATE, PermissionScope.OWN),
        perm("skill", PermissionAction.UPDATE, PermissionScope.OWN),
      ],
    },
    {
      roleCode: "MANAGER",
      perms: [
        perm("employee", PermissionAction.READ, PermissionScope.TEAM),
        perm("leave_request", PermissionAction.READ, PermissionScope.TEAM),
        perm("leave_request", PermissionAction.APPROVE, PermissionScope.TEAM),
        perm("leave_balance", PermissionAction.READ, PermissionScope.TEAM),
        perm("skill", PermissionAction.READ, PermissionScope.TEAM),
      ],
    },
    {
      roleCode: "HR_ADMIN",
      perms: [
        perm("employee", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("employee", PermissionAction.CREATE, PermissionScope.BUSINESS_UNIT),
        perm("employee", PermissionAction.UPDATE, PermissionScope.BUSINESS_UNIT),
        perm("employee", PermissionAction.DELETE, PermissionScope.BUSINESS_UNIT),
        perm("leave_request", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("leave_request", PermissionAction.APPROVE, PermissionScope.BUSINESS_UNIT),
        perm("leave_balance", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("leave_balance", PermissionAction.UPDATE, PermissionScope.BUSINESS_UNIT),
        perm("user", PermissionAction.CREATE, PermissionScope.BUSINESS_UNIT),
        perm("user", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("user", PermissionAction.UPDATE, PermissionScope.BUSINESS_UNIT),
        perm("audit_log", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("salary_history", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("skill", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("skill", PermissionAction.CREATE, PermissionScope.GLOBAL),
        perm("skill", PermissionAction.UPDATE, PermissionScope.GLOBAL),
        perm("skill", PermissionAction.DELETE, PermissionScope.GLOBAL),
        perm("employee_skill", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("employee_skill", PermissionAction.CREATE, PermissionScope.BUSINESS_UNIT),
        perm("employee_skill", PermissionAction.UPDATE, PermissionScope.BUSINESS_UNIT),
        perm("employee_skill", PermissionAction.DELETE, PermissionScope.BUSINESS_UNIT),
      ],
    },
    {
      roleCode: "EXECUTIVE",
      perms: [
        perm("employee", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("leave_request", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("leave_balance", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("salary_history", PermissionAction.READ, PermissionScope.BUSINESS_UNIT),
        perm("role", PermissionAction.READ, PermissionScope.GLOBAL),
      ],
    },
    {
      roleCode: "GLOBAL_HR_ADMIN",
      perms: [
        perm("role", PermissionAction.CREATE, PermissionScope.GLOBAL),
        perm("role", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("role", PermissionAction.UPDATE, PermissionScope.GLOBAL),
        perm("role", PermissionAction.DELETE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.CREATE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("user", PermissionAction.UPDATE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.DELETE, PermissionScope.GLOBAL),
        perm("employee", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("audit_log", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("salary_history", PermissionAction.READ, PermissionScope.GLOBAL),
      ],
    },
    {
      roleCode: "SYSTEM_ADMIN",
      perms: [
        perm("employee", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("employee", PermissionAction.CREATE, PermissionScope.GLOBAL),
        perm("employee", PermissionAction.UPDATE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.CREATE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("user", PermissionAction.UPDATE, PermissionScope.GLOBAL),
        perm("user", PermissionAction.DELETE, PermissionScope.GLOBAL),
        perm("role", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("audit_log", PermissionAction.READ, PermissionScope.GLOBAL),
      ],
    },
    {
      roleCode: "SYSTEM",
      perms: [
        perm("leave_request", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("leave_balance", PermissionAction.READ, PermissionScope.GLOBAL),
        perm("employee", PermissionAction.READ, PermissionScope.GLOBAL),
      ],
    },
  ];

  for (const { roleCode, perms } of rolePermMap) {
    const r = role(roleCode);
    for (const p of perms) {
      if (!p) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
        update: {},
        create: { roleId: r.id, permissionId: p.id },
      });
    }
  }

  // ── SYSTEM_ADMIN bootstrap user ────────────────────────────────────────────
  const adminEmail = "admin@sentient.dev";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const adminPassword = randomBytes(16).toString("hex");
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        passwordHistory: [passwordHash],
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      },
    });

    const sysAdminRole = role("SYSTEM_ADMIN");
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: sysAdminRole.id,
        scope: PermissionScope.GLOBAL,
      },
    });

    // Print once — save it immediately
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  SYSTEM_ADMIN Bootstrap Credentials          ║");
    console.log("║  Email:    admin@sentient.dev                ║");
    console.log(`║  Password: ${adminPassword}  ║`);
    console.log("║  SAVE THIS — shown only once                 ║");
    console.log("╚══════════════════════════════════════════════╝\n");
  }
}

async function seedDemoUsers(): Promise<void> {
  const DEMO_PASSWORD = "Sentient@2026!";
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const engDept    = await prisma.department.findFirstOrThrow({ where: { code: "ENG" },   select: { id: true } });
  const backendTeam = await prisma.team.findFirstOrThrow(      { where: { code: "ENG-BE" }, select: { id: true } });

  const demos = [
    { email: "hradmin@sentient.dev",  roleCode: "HR_ADMIN", scope: PermissionScope.GLOBAL,     scopeEntityId: null             },
    { email: "manager@sentient.dev",  roleCode: "MANAGER",  scope: PermissionScope.DEPARTMENT, scopeEntityId: engDept.id       },
    { email: "employee@sentient.dev", roleCode: "EMPLOYEE", scope: PermissionScope.OWN,        scopeEntityId: null             },
    { email: "teamlead@sentient.dev", roleCode: "MANAGER",  scope: PermissionScope.TEAM,       scopeEntityId: backendTeam.id   },
  ] as const;

  for (const { email, roleCode, scope, scopeEntityId } of demos) {
    const roleRow = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!roleRow) continue;

    const existing = await prisma.user.findUnique({ where: { email } });
    const user = existing ?? await prisma.user.create({
      data: {
        email,
        passwordHash,
        passwordHistory: [passwordHash],
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    // Always correct active UserRole scope so re-runs fix previously wrong rows.
    const { count } = await prisma.userRole.updateMany({
      where: { userId: user.id, roleId: roleRow.id, revokedAt: null },
      data: { scope, scopeEntityId },
    });
    if (count === 0) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roleRow.id, scope, scopeEntityId },
      });
    }
  }

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  Demo Accounts (password: Sentient@2026!)        ║");
  console.log("║  hradmin@sentient.dev   → HR_ADMIN  (GLOBAL)    ║");
  console.log("║  manager@sentient.dev   → MANAGER   (DEPARTMENT)║");
  console.log("║  teamlead@sentient.dev  → MANAGER   (TEAM)      ║");
  console.log("║  employee@sentient.dev  → EMPLOYEE  (OWN)       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
}

async function seedDemoEmployees(): Promise<void> {
  const bu = await prisma.businessUnit.findFirstOrThrow({ where: { name: "Sentient HQ" } });

  const depts = await prisma.department.findMany({
    where: { businessUnitId: bu.id },
    select: { id: true, code: true },
  });
  const deptByCode = new Map(depts.map((d) => [d.code, d.id]));

  const teams = await prisma.team.findMany({
    where: { businessUnitId: bu.id },
    select: { id: true, code: true },
  });
  const teamByCode = new Map(teams.map((t) => [t.code, t.id]));

  const positions = await prisma.position.findMany({ select: { id: true, title: true } });
  const posById = new Map(positions.map((p) => [p.title, p.id]));

  const leaveTypes = await prisma.leaveType.findMany({
    where: { businessUnitId: bu.id },
    select: { id: true, name: true, defaultDaysPerYear: true },
  });

  const YEAR = 2026;

  // ── Manager demo employee ──────────────────────────────────────────────
  const managerUser = await prisma.user.findUnique({ where: { email: "manager@sentient.dev" } });
  if (managerUser && !managerUser.employeeId) {
    const managerEmp = await prisma.employee.upsert({
      where: { email: "manager@sentient.dev" },
      update: {},
      create: {
        employeeCode: "EMP-MGR-001",
        firstName: "Alex",
        lastName: "Manager",
        email: "manager@sentient.dev",
        hireDate: new Date("2023-01-10"),
        grossSalary: 95000,
        netSalary: 72000,
        departmentId: deptByCode.get("ENG") ?? null,
        teamId: teamByCode.get("ENG-BE") ?? null,
        positionId: posById.get("Software Engineer - Senior I") ?? null,
      },
    });
    await prisma.user.update({ where: { id: managerUser.id }, data: { employeeId: managerEmp.id } });
    await seedBalances(managerEmp.id, leaveTypes, YEAR);
  }

  // ── HR Admin demo employee ─────────────────────────────────────────────
  const hrAdminUser = await prisma.user.findUnique({ where: { email: "hradmin@sentient.dev" } });
  if (hrAdminUser && !hrAdminUser.employeeId) {
    const hrAdminEmp = await prisma.employee.upsert({
      where: { email: "hradmin@sentient.dev" },
      update: {},
      create: {
        employeeCode: "EMP-HR-001",
        firstName: "Sarah",
        lastName: "HRAdmin",
        email: "hradmin@sentient.dev",
        hireDate: new Date("2022-06-01"),
        grossSalary: 85000,
        netSalary: 65000,
        departmentId: deptByCode.get("HR") ?? null,
        teamId: teamByCode.get("HR-TA") ?? null,
        positionId: posById.get("HR Generalist") ?? null,
      },
    });
    await prisma.user.update({ where: { id: hrAdminUser.id }, data: { employeeId: hrAdminEmp.id } });
    await seedBalances(hrAdminEmp.id, leaveTypes, YEAR);
  }

  // ── Employee demo employee (reports to manager) ───────────────────────
  const employeeUser = await prisma.user.findUnique({ where: { email: "employee@sentient.dev" } });
  if (employeeUser && !employeeUser.employeeId) {
    const managerEmpRef = await prisma.employee.findUnique({ where: { email: "manager@sentient.dev" } });
    const empEmp = await prisma.employee.upsert({
      where: { email: "employee@sentient.dev" },
      update: {},
      create: {
        employeeCode: "EMP-ENG-001",
        firstName: "Jordan",
        lastName: "Employee",
        email: "employee@sentient.dev",
        hireDate: new Date("2024-03-01"),
        grossSalary: 65000,
        netSalary: 50000,
        departmentId: deptByCode.get("ENG") ?? null,
        teamId: teamByCode.get("ENG-BE") ?? null,
        positionId: posById.get("Software Engineer - Junior") ?? null,
        managerId: managerEmpRef?.id ?? null,
      },
    });
    await prisma.user.update({ where: { id: employeeUser.id }, data: { employeeId: empEmp.id } });
    await seedBalances(empEmp.id, leaveTypes, YEAR);
  }

  // ── Team Lead demo employee ────────────────────────────────────────────
  const teamleadUser = await prisma.user.findUnique({ where: { email: "teamlead@sentient.dev" } });
  if (teamleadUser) {
    const managerEmpRef = await prisma.employee.findUnique({ where: { email: "manager@sentient.dev" } });
    const teamleadEmp = await prisma.employee.upsert({
      where: { email: "teamlead@sentient.dev" },
      update: {},
      create: {
        employeeCode: "EMP-TL-001",
        firstName: "Taylor",
        lastName: "TeamLead",
        email: "teamlead@sentient.dev",
        hireDate: new Date("2022-09-01"),
        grossSalary: 88000,
        netSalary: 67000,
        departmentId: deptByCode.get("ENG") ?? null,
        teamId: teamByCode.get("ENG-BE") ?? null,
        positionId: posById.get("Software Engineer - Senior I") ?? null,
        managerId: managerEmpRef?.id ?? null,
      },
    });
    if (!teamleadUser.employeeId) {
      await prisma.user.update({ where: { id: teamleadUser.id }, data: { employeeId: teamleadEmp.id } });
      await seedBalances(teamleadEmp.id, leaveTypes, YEAR);
    }

    // Always set Backend team leadId (safe on re-runs).
    const backendTeamRow = await prisma.team.findFirst({ where: { code: "ENG-BE" } });
    if (backendTeamRow) {
      await prisma.team.update({ where: { id: backendTeamRow.id }, data: { leadId: teamleadEmp.id } });
    }
  }
}

async function seedBalances(
  employeeId: string,
  leaveTypes: { id: string; name: string; defaultDaysPerYear: Prisma.Decimal }[],
  year: number,
): Promise<void> {
  for (const lt of leaveTypes) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lt.id, year } },
      update: {},
      create: {
        employeeId,
        leaveTypeId: lt.id,
        year,
        totalDays: lt.defaultDaysPerYear,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  }
}

// ================================================================
// GLOBAL ORG SEED — 4 BUs × 30 employees, 3 years of history
// ================================================================

type SalaryTier = { junior: number; mid: number; senior: number; expert: number };
interface BuMeta { code: string; tier: SalaryTier }

const BU_META: Record<string, BuMeta> = {
  "Sentient HQ":     { code: "HQ",  tier: { junior: 18_000, mid: 28_000, senior: 42_000, expert: 58_000  } },
  "Sentient France": { code: "FR",  tier: { junior: 48_000, mid: 62_000, senior: 80_000, expert: 100_000 } },
  "Sentient UAE":    { code: "UAE", tier: { junior: 52_000, mid: 68_000, senior: 85_000, expert: 110_000 } },
  "Sentient UK":     { code: "UK",  tier: { junior: 55_000, mid: 70_000, senior: 90_000, expert: 118_000 } },
};

interface EmpSlot {
  deptCode: string;
  teamCode: string;
  positionTitle: string;
  isLead: boolean;
  hireYear: number;
}

const EMP_SLOTS: EmpSlot[] = [
  // Backend (9)
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Engineering Manager",           isLead: true,  hireYear: 2020 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "Software Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-BE", positionTitle: "QA Engineer",                   isLead: false, hireYear: 2024 },
  // Frontend (9)
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Technical Lead",                isLead: true,  hireYear: 2020 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Frontend Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Frontend Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Software Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Frontend Engineer - Junior",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Frontend Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-FE", positionTitle: "Data Engineer",                 isLead: false, hireYear: 2024 },
  // HR – Talent Acquisition (3)
  { deptCode: "HR",  teamCode: "HR-TA",  positionTitle: "HR Business Partner",           isLead: true,  hireYear: 2020 },
  { deptCode: "HR",  teamCode: "HR-TA",  positionTitle: "HR Generalist",                 isLead: false, hireYear: 2022 },
  { deptCode: "HR",  teamCode: "HR-TA",  positionTitle: "HR Generalist",                 isLead: false, hireYear: 2023 },
  // HR – Learning & Development (3)
  { deptCode: "HR",  teamCode: "HR-LD",  positionTitle: "HR Business Partner",           isLead: true,  hireYear: 2021 },
  { deptCode: "HR",  teamCode: "HR-LD",  positionTitle: "HR Generalist",                 isLead: false, hireYear: 2022 },
  { deptCode: "HR",  teamCode: "HR-LD",  positionTitle: "HR Generalist",                 isLead: false, hireYear: 2023 },
  // Product Strategy (3)
  { deptCode: "PRD", teamCode: "PRD-PS", positionTitle: "Product Manager",               isLead: true,  hireYear: 2020 },
  { deptCode: "PRD", teamCode: "PRD-PS", positionTitle: "Product Owner",                 isLead: false, hireYear: 2021 },
  { deptCode: "PRD", teamCode: "PRD-PS", positionTitle: "Product Owner",                 isLead: false, hireYear: 2022 },
  // Product Design (3)
  { deptCode: "PRD", teamCode: "PRD-DS", positionTitle: "Product Manager",               isLead: true,  hireYear: 2021 },
  { deptCode: "PRD", teamCode: "PRD-DS", positionTitle: "Product Owner",                 isLead: false, hireYear: 2022 },
  { deptCode: "PRD", teamCode: "PRD-DS", positionTitle: "Product Owner",                 isLead: false, hireYear: 2023 },
];

const TEAM_SKILLS: Record<string, string[]> = {
  "ENG-BE": ["TypeScript", "Node.js", "NestJS", "PostgreSQL", "Docker", "Git", "Redis", "AWS", "CI/CD", "Python", "Go", "Kafka", "GraphQL"],
  "ENG-FE": ["TypeScript", "React", "Vue.js", "Angular", "CSS / Tailwind", "Git", "Docker", "Figma", "AWS"],
  "HR-TA":  ["Communication", "Leadership", "Mentoring", "Negotiation", "English", "French", "Project Management"],
  "HR-LD":  ["Communication", "Leadership", "Mentoring", "English", "French", "Agile / Scrum", "Project Management"],
  "PRD-PS": ["Project Management", "Agile / Scrum", "Data Analysis", "Communication", "Leadership", "English", "Figma"],
  "PRD-DS": ["Figma", "UX Research", "Adobe XD", "Communication", "Agile / Scrum", "English", "CSS / Tailwind"],
};

interface BulkEmployee {
  id:           string;
  departmentId: string | null;
  teamId:       string | null;
  hireDate:     Date;
  grossSalary:  number;
  buId:         string;
  teamCode:     string;
}

interface FakerData { firstName: string; lastName: string; phone: string; dateOfBirth: Date }

function buildHireDate(year: number, idx: number): Date {
  return new Date(year, (idx * 2) % 12, (idx * 7) % 25 + 1);
}

function levelToSalary(level: PositionLevel | null | undefined, tier: SalaryTier): number {
  switch (level) {
    case PositionLevel.JUNIOR:    return tier.junior;
    case PositionLevel.MEDIUM:    return tier.mid;
    case PositionLevel.CONFIRMED: return tier.mid;
    case PositionLevel.SENIOR_1:  return tier.senior;
    case PositionLevel.SENIOR_2:  return tier.senior;
    case PositionLevel.EXPERT:    return tier.expert;
    default:                      return tier.mid;
  }
}

function applyJitter(base: number, idx: number): number {
  const pct = (idx % 11) - 5; // -5 to +5 %
  return Math.round(base * (1 + pct / 100));
}

async function seedGlobalOrg(): Promise<void> {
  faker.seed(42);

  await seedExtendedPositions();
  await seedExtendedSkills();

  const subsidiaries = await seedGlobalBusinessUnits();
  const hqBu         = await prisma.businessUnit.findFirstOrThrow({ where: { name: "Sentient HQ" } });
  const allBUs       = [hqBu, ...subsidiaries];

  for (const bu of allBUs) {
    await seedBuStructure(bu);
  }

  // Pre-generate all faker personal data up front so order is deterministic
  const allFakerData: FakerData[] = Array.from({ length: allBUs.length * EMP_SLOTS.length }, () => ({
    firstName:   faker.person.firstName(),
    lastName:    faker.person.lastName(),
    phone:       faker.phone.number({ style: "international" }),
    dateOfBirth: faker.date.birthdate({ min: 24, max: 55, mode: "age" }),
  }));

  const allEmployees: BulkEmployee[] = [];
  for (let buIdx = 0; buIdx < allBUs.length; buIdx++) {
    const bu   = allBUs[buIdx]!;
    const data = allFakerData.slice(buIdx * EMP_SLOTS.length, (buIdx + 1) * EMP_SLOTS.length);
    const emps = await seedBulkEmployeesForBu(bu, data);
    allEmployees.push(...emps);
  }

  await seedAllHistory(allEmployees);
  console.log(`\n✅  Global org seeded: ${allEmployees.length} bulk employees across ${allBUs.length} BUs.`);
}

async function seedGlobalBusinessUnits(): Promise<{ id: string; name: string }[]> {
  const defs = [
    { name: "Sentient France", address: "Paris, France"  },
    { name: "Sentient UAE",    address: "Dubai, UAE"     },
    { name: "Sentient UK",     address: "London, UK"     },
  ];

  const results: { id: string; name: string }[] = [];
  for (const def of defs) {
    const bu = await prisma.businessUnit.upsert({ where: { name: def.name }, update: {}, create: def });
    results.push(bu);

    const leaveDefs = [
      { name: "Annual Leave",    defaultDaysPerYear: 25, accrualFrequency: AccrualFrequency.MONTHLY, maxCarryoverDays: 5, requiresApproval: true, color: "#4CAF50" },
      { name: "Sick Leave",      defaultDaysPerYear: 15, accrualFrequency: AccrualFrequency.MONTHLY, maxCarryoverDays: 0, requiresApproval: true, color: "#F44336" },
      { name: "Maternity Leave", defaultDaysPerYear: 98, accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0, requiresApproval: true, color: "#E91E63" },
      { name: "Paternity Leave", defaultDaysPerYear: 5,  accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0, requiresApproval: true, color: "#2196F3" },
      { name: "Unpaid Leave",    defaultDaysPerYear: 0,  accrualFrequency: AccrualFrequency.YEARLY,  maxCarryoverDays: 0, requiresApproval: true, color: "#9E9E9E" },
    ] as const;
    for (const lt of leaveDefs) {
      await prisma.leaveType.upsert({
        where:  { name_businessUnitId: { name: lt.name, businessUnitId: bu.id } },
        update: {},
        create: { ...lt, businessUnitId: bu.id },
      });
    }

    const holidays = [
      { name: "New Year's Day", date: "2026-01-01", year: 2026 },
      { name: "Labour Day",     date: "2026-05-01", year: 2026 },
      { name: "Christmas Day",  date: "2026-12-25", year: 2026 },
      { name: "Boxing Day",     date: "2026-12-26", year: 2026 },
    ];
    for (const h of holidays) {
      await prisma.holiday.upsert({
        where:  { date_businessUnitId_year: { date: new Date(`${h.date}T00:00:00.000Z`), businessUnitId: bu.id, year: h.year } },
        update: {},
        create: { businessUnitId: bu.id, name: h.name, date: new Date(`${h.date}T00:00:00.000Z`), isRecurring: false, year: h.year },
      });
    }
  }
  return results;
}

async function seedBuStructure(bu: { id: string; name: string }): Promise<void> {
  await prisma.department.createMany({
    data: [
      { name: "Engineering",     code: "ENG", businessUnitId: bu.id, description: "Engineering department" },
      { name: "Human Resources", code: "HR",  businessUnitId: bu.id, description: "People operations"      },
      { name: "Product",         code: "PRD", businessUnitId: bu.id, description: "Product management"     },
    ],
    skipDuplicates: true,
  });

  const depts   = await prisma.department.findMany({ where: { businessUnitId: bu.id, code: { in: ["ENG", "HR", "PRD"] } }, select: { id: true, code: true } });
  const byCode  = new Map(depts.map((d) => [d.code, d.id]));

  await prisma.team.createMany({
    data: [
      { name: "Backend",                code: "ENG-BE", departmentId: byCode.get("ENG") ?? "", businessUnitId: bu.id },
      { name: "Frontend",               code: "ENG-FE", departmentId: byCode.get("ENG") ?? "", businessUnitId: bu.id },
      { name: "Talent Acquisition",     code: "HR-TA",  departmentId: byCode.get("HR")  ?? "", businessUnitId: bu.id },
      { name: "Learning & Development", code: "HR-LD",  departmentId: byCode.get("HR")  ?? "", businessUnitId: bu.id },
      { name: "Product Strategy",       code: "PRD-PS", departmentId: byCode.get("PRD") ?? "", businessUnitId: bu.id },
      { name: "Product Design",         code: "PRD-DS", departmentId: byCode.get("PRD") ?? "", businessUnitId: bu.id },
    ].filter((t) => Boolean(t.departmentId)),
    skipDuplicates: true,
  });
}

async function seedExtendedPositions(): Promise<void> {
  await prisma.position.createMany({
    data: [
      { title: "Software Engineer - Medium",    level: PositionLevel.MEDIUM    },
      { title: "Software Engineer - Confirmed", level: PositionLevel.CONFIRMED },
      { title: "Software Engineer - Senior II", level: PositionLevel.SENIOR_2  },
      { title: "Software Engineer - Expert",    level: PositionLevel.EXPERT    },
      { title: "Frontend Engineer - Junior",    level: PositionLevel.JUNIOR    },
      { title: "Frontend Engineer - Senior I",  level: PositionLevel.SENIOR_1  },
      { title: "Engineering Manager",           level: PositionLevel.SENIOR_2  },
      { title: "Data Engineer",                 level: PositionLevel.MEDIUM    },
      { title: "QA Engineer",                   level: PositionLevel.MEDIUM    },
      { title: "HR Business Partner",           level: PositionLevel.SENIOR_1  },
      { title: "HR Director",                   level: PositionLevel.EXPERT    },
      { title: "Product Owner",                 level: PositionLevel.SENIOR_1  },
      { title: "Technical Lead",                level: PositionLevel.SENIOR_2  },
    ],
    skipDuplicates: true,
  });
}

async function seedExtendedSkills(): Promise<void> {
  const skills = [
    { name: "Vue.js",             category: "Frontend"    },
    { name: "Angular",            category: "Frontend"    },
    { name: "CSS / Tailwind",     category: "Frontend"    },
    { name: "Node.js",            category: "Backend"     },
    { name: "NestJS",             category: "Backend"     },
    { name: "Python",             category: "Backend"     },
    { name: "Java",               category: "Backend"     },
    { name: "Go",                 category: "Backend"     },
    { name: "GraphQL",            category: "Backend"     },
    { name: "AWS",                category: "Cloud"       },
    { name: "Azure",              category: "Cloud"       },
    { name: "GCP",                category: "Cloud"       },
    { name: "Terraform",          category: "DevOps"      },
    { name: "Linux",              category: "DevOps"      },
    { name: "CI/CD",              category: "DevOps"      },
    { name: "Git",                category: "DevOps"      },
    { name: "Redis",              category: "Database"    },
    { name: "MongoDB",            category: "Database"    },
    { name: "Elasticsearch",      category: "Database"    },
    { name: "Kafka",              category: "Messaging"   },
    { name: "Data Analysis",      category: "Analytics"   },
    { name: "Figma",              category: "Design"      },
    { name: "UX Research",        category: "Design"      },
    { name: "Adobe XD",           category: "Design"      },
    { name: "Project Management", category: "Soft Skills" },
    { name: "Agile / Scrum",      category: "Soft Skills" },
    { name: "Mentoring",          category: "Soft Skills" },
    { name: "Negotiation",        category: "Soft Skills" },
    { name: "Spanish",            category: "Language"    },
    { name: "German",             category: "Language"    },
    { name: "Chinese",            category: "Language"    },
  ];
  for (const s of skills) {
    await prisma.skill.upsert({ where: { name: s.name }, update: {}, create: s });
  }
}

async function seedBulkEmployeesForBu(
  bu: { id: string; name: string },
  fakerData: FakerData[],
): Promise<BulkEmployee[]> {
  const meta    = BU_META[bu.name] ?? { code: "BU", tier: { junior: 30_000, mid: 45_000, senior: 60_000, expert: 80_000 } };
  const { code: buCode, tier } = meta;

  const depts      = await prisma.department.findMany({ where: { businessUnitId: bu.id, code: { in: ["ENG", "HR", "PRD"] } }, select: { id: true, code: true } });
  const deptByCode = new Map(depts.map((d) => [d.code, d.id]));
  const teams      = await prisma.team.findMany({ where: { businessUnitId: bu.id }, select: { id: true, code: true } });
  const teamByCode = new Map(teams.map((t) => [t.code, t.id]));
  const positions  = await prisma.position.findMany({ select: { id: true, title: true, level: true } });
  const posMap     = new Map(positions.map((p) => [p.title, p]));
  const leaveTypes = await prisma.leaveType.findMany({ where: { businessUnitId: bu.id }, select: { id: true, name: true, defaultDaysPerYear: true } });

  const teamLeadIds = new Map<string, string>();

  // Pass 1: create leads
  for (let i = 0; i < EMP_SLOTS.length; i++) {
    const slot = EMP_SLOTS[i]!;
    if (!slot.isLead) continue;
    const fd    = fakerData[i]!;
    const email = `emp.${buCode.toLowerCase()}.${String(i).padStart(3, "0")}@sentient.dev`;
    const pos   = posMap.get(slot.positionTitle);
    const gross = applyJitter(levelToSalary(pos?.level, tier), i);

    const emp = await prisma.employee.upsert({
      where:  { email },
      update: {},
      create: {
        employeeCode:     `${buCode}-${String(i).padStart(3, "0")}`,
        firstName:        fd.firstName,
        lastName:         fd.lastName,
        email,
        phone:            fd.phone,
        dateOfBirth:      fd.dateOfBirth,
        hireDate:         buildHireDate(slot.hireYear, i),
        grossSalary:      gross,
        netSalary:        Math.round(gross * 0.76),
        departmentId:     deptByCode.get(slot.deptCode) ?? null,
        teamId:           teamByCode.get(slot.teamCode) ?? null,
        positionId:       pos?.id ?? null,
        employmentStatus: "ACTIVE",
        contractType:     "FULL_TIME",
      },
    });

    teamLeadIds.set(slot.teamCode, emp.id);

    const years = ([2023, 2024, 2025, 2026] as const).filter((y) => y >= slot.hireYear);
    for (const year of years) {
      await seedBalances(emp.id, leaveTypes, year);
    }
  }

  // Set team leadId for non-HQ subsidiaries
  if (bu.name !== "Sentient HQ") {
    for (const [teamCode, leadId] of teamLeadIds) {
      const team = await prisma.team.findFirst({ where: { code: teamCode, businessUnitId: bu.id } });
      if (team) await prisma.team.update({ where: { id: team.id }, data: { leadId } });
    }
  }

  // Pass 2: create ICs
  for (let i = 0; i < EMP_SLOTS.length; i++) {
    const slot = EMP_SLOTS[i]!;
    if (slot.isLead) continue;
    const fd    = fakerData[i]!;
    const email = `emp.${buCode.toLowerCase()}.${String(i).padStart(3, "0")}@sentient.dev`;
    const pos   = posMap.get(slot.positionTitle);
    const gross = applyJitter(levelToSalary(pos?.level, tier), i);

    const emp = await prisma.employee.upsert({
      where:  { email },
      update: {},
      create: {
        employeeCode:     `${buCode}-${String(i).padStart(3, "0")}`,
        firstName:        fd.firstName,
        lastName:         fd.lastName,
        email,
        phone:            fd.phone,
        dateOfBirth:      fd.dateOfBirth,
        hireDate:         buildHireDate(slot.hireYear, i),
        grossSalary:      gross,
        netSalary:        Math.round(gross * 0.76),
        departmentId:     deptByCode.get(slot.deptCode) ?? null,
        teamId:           teamByCode.get(slot.teamCode) ?? null,
        positionId:       pos?.id ?? null,
        managerId:        teamLeadIds.get(slot.teamCode) ?? null,
        employmentStatus: "ACTIVE",
        contractType:     "FULL_TIME",
      },
    });

    const years = ([2023, 2024, 2025, 2026] as const).filter((y) => y >= slot.hireYear);
    for (const year of years) {
      await seedBalances(emp.id, leaveTypes, year);
    }
  }

  const emails    = EMP_SLOTS.map((_, i) => `emp.${buCode.toLowerCase()}.${String(i).padStart(3, "0")}@sentient.dev`);
  const employees = await prisma.employee.findMany({
    where:  { email: { in: emails } },
    select: { id: true, departmentId: true, teamId: true, hireDate: true, grossSalary: true },
  });

  return employees.map((e, idx) => ({
    id:           e.id,
    departmentId: e.departmentId,
    teamId:       e.teamId,
    hireDate:     e.hireDate,
    grossSalary:  Number(e.grossSalary ?? 0),
    buId:         bu.id,
    teamCode:     EMP_SLOTS[idx % EMP_SLOTS.length]?.teamCode ?? "ENG-BE",
  }));
}

// ── History orchestrator ──────────────────────────────────────────

async function seedAllHistory(employees: BulkEmployee[]): Promise<void> {
  // Use a fixed placeholder for changedById — it's a String with no FK
  const changedById = "seed-script";

  await seedSalaryHistory(employees, changedById);
  await seedSkillEvolution(employees);
  await seedLeaveHistory(employees);
}

// ── Salary history ────────────────────────────────────────────────

async function seedSalaryHistory(employees: BulkEmployee[], changedById: string): Promise<void> {
  const NOW = new Date("2026-05-07T00:00:00.000Z");

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]!;

    const existing = await prisma.salaryHistory.count({ where: { employeeId: emp.id } });
    if (existing > 0) continue;

    const yearsExp   = 2026 - emp.hireDate.getFullYear();
    let currentGross = emp.grossSalary;
    let currentNet   = Math.round(currentGross * 0.76);

    const raises: { effectiveDate: Date; previousGross: number; newGross: number; previousNet: number; newNet: number; reason: SalaryChangeReason }[] = [];

    for (let yr = 1; yr <= Math.min(yearsExp, 3); yr++) {
      const effDate = new Date(emp.hireDate);
      effDate.setFullYear(effDate.getFullYear() + yr);
      if (effDate >= NOW) break;

      const isPromotion = yr >= 2 && i % 3 === 0;
      const raiseMin    = isPromotion ? 10 : 5;
      const raiseMax    = isPromotion ? 15 : 8;
      const raisePct    = raiseMin + ((i + yr) % (raiseMax - raiseMin + 1));
      const newGross    = Math.round(currentGross * (1 + raisePct / 100));
      const newNet      = Math.round(newGross * 0.76);

      raises.push({
        effectiveDate: effDate,
        previousGross: currentGross,
        newGross,
        previousNet:   currentNet,
        newNet,
        reason: isPromotion ? SalaryChangeReason.PROMOTION : SalaryChangeReason.ANNUAL_REVIEW,
      });
      currentGross = newGross;
      currentNet   = newNet;
    }

    for (const r of raises) {
      const grossRaisePct = ((r.newGross - r.previousGross) / r.previousGross) * 100;
      await prisma.salaryHistory.create({
        data: {
          employeeId:           emp.id,
          previousGrossSalary:  r.previousGross,
          newGrossSalary:       r.newGross,
          previousNetSalary:    r.previousNet,
          newNetSalary:         r.newNet,
          grossRaisePercentage: Math.round(grossRaisePct * 100) / 100,
          effectiveDate:        r.effectiveDate,
          reason:               r.reason,
          changedById,
        },
      });
    }

    if (raises.length > 0) {
      await prisma.employee.update({
        where: { id: emp.id },
        data:  { grossSalary: currentGross, netSalary: currentNet },
      });
    }
  }
}

// ── Skill evolution ───────────────────────────────────────────────

interface SkillStep { level: ProficiencyLevel; offsetMonths: number; source: SourceLevel }

function buildSkillProgression(yearsExp: number, empIdx: number): SkillStep[] {
  const steps: SkillStep[] = [
    { level: ProficiencyLevel.BEGINNER,     offsetMonths: 1,  source: SourceLevel.RECRUITMENT },
  ];
  if (yearsExp >= 1) {
    steps.push({ level: ProficiencyLevel.INTERMEDIATE, offsetMonths: 12, source: SourceLevel.TRAINING });
  }
  if (yearsExp >= 2) {
    steps.push({
      level:        ProficiencyLevel.ADVANCED,
      offsetMonths: 24,
      source:       empIdx % 3 === 0 ? SourceLevel.CERTIFICATION : SourceLevel.MANAGER,
    });
  }
  if (yearsExp >= 4 && empIdx % 4 === 0) {
    steps.push({ level: ProficiencyLevel.EXPERT, offsetMonths: 48, source: SourceLevel.CERTIFICATION });
  }
  return steps;
}

async function seedSkillEvolution(employees: BulkEmployee[]): Promise<void> {
  const allSkills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const skillMap  = new Map(allSkills.map((s) => [s.name, s.id]));
  const NOW       = new Date("2026-05-07T00:00:00.000Z");

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]!;

    const alreadyHasSkills = await prisma.employeeSkill.count({ where: { employeeId: emp.id } });
    if (alreadyHasSkills > 0) continue;

    const pool      = TEAM_SKILLS[emp.teamCode] ?? [];
    const numSkills = 4 + (i % 3);
    const picked    = pool.slice(0, Math.min(numSkills, pool.length));
    const yearsExp  = 2026 - emp.hireDate.getFullYear();

    for (const skillName of picked) {
      const skillId = skillMap.get(skillName);
      if (!skillId) continue;

      const steps = buildSkillProgression(yearsExp, i);
      let prev: ProficiencyLevel | null = null;

      for (const step of steps) {
        const effDate = new Date(emp.hireDate);
        effDate.setMonth(effDate.getMonth() + step.offsetMonths);
        if (effDate >= NOW) break;

        await prisma.skillHistory.create({
          data: {
            employeeId:    emp.id,
            skillId,
            previousLevel: prev,
            newLevel:      step.level,
            effectiveDate: effDate,
            source:        step.source,
          },
        });
        prev = step.level;
      }

      if (prev !== null) {
        await prisma.employeeSkill.create({
          data: { employeeId: emp.id, skillId, proficiency: prev, acquiredDate: emp.hireDate },
        });
      }
    }
  }
}

// ── Leave history ─────────────────────────────────────────────────

async function seedLeaveHistory(employees: BulkEmployee[]): Promise<void> {
  // Build a reviewer: use first HR-TA lead employee found (has APPROVED power)
  const reviewer = await prisma.employee.findFirst({
    where: { email: { startsWith: "emp." }, team: { code: "HR-TA" } },
    select: { id: true },
  });
  const reviewerId = reviewer?.id ?? null;

  // Build buId → leaveTypes map
  const allLeaveTypes = await prisma.leaveType.findMany({ select: { id: true, name: true, businessUnitId: true } });
  const ltByBu        = new Map<string, typeof allLeaveTypes>();
  for (const lt of allLeaveTypes) {
    if (!ltByBu.has(lt.businessUnitId)) ltByBu.set(lt.businessUnitId, []);
    ltByBu.get(lt.businessUnitId)!.push(lt);
  }

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]!;

    const existing = await prisma.leaveRequest.count({ where: { employeeId: emp.id } });
    if (existing > 0) continue;

    const leaveTypes  = ltByBu.get(emp.buId) ?? [];
    const annualLt    = leaveTypes.find((lt) => lt.name === "Annual Leave");
    const sickLt      = leaveTypes.find((lt) => lt.name === "Sick Leave");
    if (!annualLt || !sickLt) continue;

    const hireYear    = emp.hireDate.getFullYear();
    const usedDays    = new Map<string, number>(); // `${ltId}-${year}` => days

    const track = (ltId: string, year: number, days: number): void => {
      const key = `${ltId}-${year}`;
      usedDays.set(key, (usedDays.get(key) ?? 0) + days);
    };

    type RequestSpec = {
      leaveTypeId: string;
      startDate: Date;
      endDate: Date;
      totalDays: number;
      status: LeaveStatus;
      year: number;
      reviewedAt?: Date;
    };

    const requests: RequestSpec[] = [];
    const variant = i % 4;

    // 2024 requests
    if (hireYear <= 2024) {
      const julyStart = new Date(2024, 6, 14 + (i % 5));
      const julyEnd   = new Date(2024, 6, 18 + (i % 5));
      requests.push({ leaveTypeId: annualLt.id, startDate: julyStart, endDate: julyEnd, totalDays: 5, status: LeaveStatus.APPROVED, year: 2024, reviewedAt: new Date(2024, 5, 20) });

      const febStart  = new Date(2024, 1, 5 + (i % 3));
      const febEnd    = new Date(2024, 1, 6 + (i % 3));
      requests.push({ leaveTypeId: sickLt.id, startDate: febStart, endDate: febEnd, totalDays: 2, status: LeaveStatus.APPROVED, year: 2024, reviewedAt: new Date(2024, 1, 7) });

      if (variant < 2) {
        const marStart = new Date(2024, 2, 10 + (i % 5));
        const marEnd   = new Date(2024, 2, 12 + (i % 5));
        requests.push({ leaveTypeId: annualLt.id, startDate: marStart, endDate: marEnd, totalDays: 3, status: LeaveStatus.REJECTED, year: 2024, reviewedAt: new Date(2024, 2, 5) });
      }
    }

    // 2025 requests
    if (hireYear <= 2025) {
      const julStart2 = new Date(2025, 6, 7 + (i % 5));
      const julEnd2   = new Date(2025, 6, 11 + (i % 5));
      requests.push({ leaveTypeId: annualLt.id, startDate: julStart2, endDate: julEnd2, totalDays: 5, status: LeaveStatus.APPROVED, year: 2025, reviewedAt: new Date(2025, 5, 25) });

      const novStart  = new Date(2025, 10, 3 + (i % 3));
      const novEnd    = new Date(2025, 10, 4 + (i % 3));
      requests.push({ leaveTypeId: sickLt.id, startDate: novStart, endDate: novEnd, totalDays: 2, status: LeaveStatus.APPROVED, year: 2025, reviewedAt: new Date(2025, 10, 5) });

      if (variant === 0) {
        const decStart  = new Date(2025, 11, 22 + (i % 3));
        const decEnd    = new Date(2025, 11, 24 + (i % 3));
        requests.push({ leaveTypeId: annualLt.id, startDate: decStart, endDate: decEnd, totalDays: 3, status: LeaveStatus.CANCELLED, year: 2025 });
      }
    }

    // 2026 requests
    {
      const status    = variant < 2 ? LeaveStatus.APPROVED : LeaveStatus.PENDING;
      const julStart3 = new Date(2026, 6, 20 + (i % 5));
      const julEnd3   = new Date(2026, 6, 24 + (i % 5));
      const req: RequestSpec = { leaveTypeId: annualLt.id, startDate: julStart3, endDate: julEnd3, totalDays: 5, status, year: 2026 };
      if (status === LeaveStatus.APPROVED) req.reviewedAt = new Date(2026, 4, 15);
      requests.push(req);
    }

    for (const req of requests) {
      await prisma.leaveRequest.create({
        data: {
          employeeId:   emp.id,
          leaveTypeId:  req.leaveTypeId,
          startDate:    req.startDate,
          endDate:      req.endDate,
          totalDays:    req.totalDays,
          status:       req.status,
          reviewedById: req.status !== LeaveStatus.PENDING && req.status !== LeaveStatus.CANCELLED ? reviewerId : null,
          reviewedAt:   req.reviewedAt ?? null,
        },
      });

      if (req.status === LeaveStatus.APPROVED) {
        track(req.leaveTypeId, req.year, req.totalDays);
      }
    }

    // Update leave balance usedDays
    for (const [key, days] of usedDays) {
      const dash  = key.lastIndexOf("-");
      const ltId  = key.slice(0, dash);
      const year  = parseInt(key.slice(dash + 1), 10);
      await prisma.leaveBalance.updateMany({
        where: { employeeId: emp.id, leaveTypeId: ltId, year },
        data:  { usedDays: days },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
