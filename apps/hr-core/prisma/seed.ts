import { PositionLevel, PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.department.createMany({
    data: [
      {
        name: "Engineering",
        code: "ENG",
        description: "Engineering department",
      },
      { name: "Human Resources", code: "HR", description: "People operations" },
      { name: "Product", code: "PRD", description: "Product management" },
    ],
    skipDuplicates: true,
  });

  await prisma.position.createMany({
    data: [
      { title: "Software Engineer - Junior", level: PositionLevel.JUNIOR },
      { title: "Software Engineer - Senior I", level: PositionLevel.SENIOR_1 },
      { title: "HR Generalist", level: PositionLevel.CONFIRMED },
      { title: "Product Manager", level: PositionLevel.CONFIRMED },
      { title: "DevOps Engineer", level: PositionLevel.MEDIUM },
    ],
    skipDuplicates: true,
  });

  const departments = await prisma.department.findMany({
    where: {
      code: {
        in: ["ENG", "HR", "PRD"],
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const byCode = new Map(
    departments.map((department) => [department.code, department.id]),
  );

  // Team seed depends on seeded departments, so we resolve IDs by code first.
  await prisma.team.createMany({
    data: [
      {
        name: "Backend",
        code: "ENG-BE",
        departmentId: byCode.get("ENG") ?? "",
      },
      {
        name: "Frontend",
        code: "ENG-FE",
        departmentId: byCode.get("ENG") ?? "",
      },
      {
        name: "Talent Acquisition",
        code: "HR-TA",
        departmentId: byCode.get("HR") ?? "",
      },
      {
        name: "Learning & Development",
        code: "HR-LD",
        departmentId: byCode.get("HR") ?? "",
      },
      {
        name: "Product Strategy",
        code: "PRD-PS",
        departmentId: byCode.get("PRD") ?? "",
      },
      {
        name: "Product Design",
        code: "PRD-DS",
        departmentId: byCode.get("PRD") ?? "",
      },
    ].filter((team) => Boolean(team.departmentId)),
    skipDuplicates: true,
  });

  // Seed EnumMeta for ordered dropdowns and numeric comparison.
  // WHY: Prisma enums are stored as strings — EnumMeta provides rank + label
  // so the UI can show ordered option lists and the app can compare levels numerically.
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
