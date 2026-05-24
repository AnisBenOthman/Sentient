"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/generated/prisma");
const prisma = new prisma_1.PrismaClient();
async function main() {
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
            { title: "Software Engineer - Junior", level: "Junior" },
            { title: "Software Engineer - Senior", level: "Senior" },
            { title: "HR Generalist", level: null },
            { title: "Product Manager", level: null },
            { title: "DevOps Engineer", level: null },
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
    const byCode = new Map(departments.map((department) => [department.code, department.id]));
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
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map