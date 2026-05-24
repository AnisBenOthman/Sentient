import path from "node:path";
import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccrualFrequency,
  PermissionAction,
  PermissionScope,
  PositionLevel,
  PrismaClient,
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

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
