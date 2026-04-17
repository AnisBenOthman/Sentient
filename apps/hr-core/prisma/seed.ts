import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PositionLevel, PrismaClient } from "../src/generated/prisma";

loadEnv({ path: path.join(__dirname, "..", ".env") });

const adapter = new PrismaPg({ connectionString: process.env["HR_CORE_DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
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

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
