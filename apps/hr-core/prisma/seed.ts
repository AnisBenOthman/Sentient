import path from "node:path";
import { config as loadEnv } from "dotenv";
import * as argon2 from "argon2";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccrualFrequency,
  ContractType,
  EducationLevel,
  EmploymentStatus,
  Gender,
  KeyPositionRisk,
  LeaveStatus,
  MaritalStatus,
  PerformanceRating,
  PerformanceReviewAuditAction,
  PermissionAction,
  PermissionScope,
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

faker.seed(42);

// ============================================================
// CONSTANTS
// ============================================================

const DEMO_PASSWORD = "Sentient@2026!";

const BU_CONFIGS = [
  { name: "Sentient HQ",     code: "HQ",  address: "Algiers, Algeria", salaryTiers: { jr: 18000,  mid: 28000,  sr: 42000,  ex: 58000  } },
  { name: "Sentient France", code: "FR",  address: "Paris, France",    salaryTiers: { jr: 48000,  mid: 62000,  sr: 80000,  ex: 100000 } },
  { name: "Sentient UAE",    code: "UAE", address: "Dubai, UAE",       salaryTiers: { jr: 52000,  mid: 68000,  sr: 85000,  ex: 110000 } },
  { name: "Sentient UK",     code: "UK",  address: "London, UK",       salaryTiers: { jr: 55000,  mid: 70000,  sr: 90000,  ex: 118000 } },
] as const;

const BU_HEADCOUNTS: Record<string, number> = {
  "Sentient HQ":     70,
  "Sentient France": 50,
  "Sentient UAE":    45,
  "Sentient UK":     35,
};

const DEPT_DEFS = [
  { code: "ENG", name: "Engineering",     description: "Software engineering department" },
  { code: "HR",  name: "Human Resources", description: "People operations & talent" },
  { code: "PRD", name: "Product",         description: "Product management & design" },
  { code: "FIN", name: "Finance",         description: "Finance & accounting" },
  { code: "SAL", name: "Sales",           description: "Revenue & growth" },
] as const;

const TEAM_DEFS = [
  { code: "ENG-BE",   name: "Backend",               deptCode: "ENG" },
  { code: "ENG-FE",   name: "Frontend",               deptCode: "ENG" },
  { code: "HR-TA",    name: "Talent Acquisition",     deptCode: "HR"  },
  { code: "HR-LD",    name: "Learning & Development", deptCode: "HR"  },
  { code: "PRD-PS",   name: "Product Strategy",       deptCode: "PRD" },
  { code: "PRD-DS",   name: "Product Design",         deptCode: "PRD" },
  { code: "FIN-CTRL", name: "Financial Control",      deptCode: "FIN" },
  { code: "FIN-FPA",  name: "FP&A",                   deptCode: "FIN" },
  { code: "SAL-ENT",  name: "Enterprise Sales",       deptCode: "SAL" },
  { code: "SAL-SMB",  name: "SMB & Accounts",         deptCode: "SAL" },
] as const;

interface EmpSlot {
  deptCode: string;
  teamCode: string;
  positionTitle: string;
  isLead: boolean;
  hireYear: number;
}

// 70-slot template — sliced per BU headcount
// Total: 12+10+5+5+6+5+8+7+6+6 = 70
const EMP_SLOTS: EmpSlot[] = [
  // ENG-BE (12)
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Engineering Manager",           isLead: true,  hireYear: 2020 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "Software Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "QA Engineer",                   isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-BE",   positionTitle: "DevOps Engineer",               isLead: false, hireYear: 2023 },
  // ENG-FE (10)
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Technical Lead",                isLead: true,  hireYear: 2020 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Senior I",  isLead: false, hireYear: 2021 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Confirmed", isLead: false, hireYear: 2022 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Medium",    isLead: false, hireYear: 2023 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "Frontend Engineer - Junior",    isLead: false, hireYear: 2024 },
  { deptCode: "ENG", teamCode: "ENG-FE",   positionTitle: "UX Designer",                   isLead: false, hireYear: 2024 },
  // HR-TA (5)
  { deptCode: "HR",  teamCode: "HR-TA",    positionTitle: "HR Business Partner",           isLead: true,  hireYear: 2020 },
  { deptCode: "HR",  teamCode: "HR-TA",    positionTitle: "HR Generalist",                 isLead: false, hireYear: 2022 },
  { deptCode: "HR",  teamCode: "HR-TA",    positionTitle: "HR Generalist",                 isLead: false, hireYear: 2023 },
  { deptCode: "HR",  teamCode: "HR-TA",    positionTitle: "Recruiter",                     isLead: false, hireYear: 2023 },
  { deptCode: "HR",  teamCode: "HR-TA",    positionTitle: "Recruiter",                     isLead: false, hireYear: 2024 },
  // HR-LD (5)
  { deptCode: "HR",  teamCode: "HR-LD",    positionTitle: "HR Business Partner",           isLead: true,  hireYear: 2021 },
  { deptCode: "HR",  teamCode: "HR-LD",    positionTitle: "HR Generalist",                 isLead: false, hireYear: 2022 },
  { deptCode: "HR",  teamCode: "HR-LD",    positionTitle: "HR Generalist",                 isLead: false, hireYear: 2023 },
  { deptCode: "HR",  teamCode: "HR-LD",    positionTitle: "L&D Specialist",                isLead: false, hireYear: 2023 },
  { deptCode: "HR",  teamCode: "HR-LD",    positionTitle: "L&D Specialist",                isLead: false, hireYear: 2024 },
  // PRD-PS (6)
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Product Manager",               isLead: true,  hireYear: 2020 },
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Product Owner",                 isLead: false, hireYear: 2021 },
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Product Owner",                 isLead: false, hireYear: 2022 },
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Product Owner",                 isLead: false, hireYear: 2023 },
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Business Analyst",              isLead: false, hireYear: 2023 },
  { deptCode: "PRD", teamCode: "PRD-PS",   positionTitle: "Business Analyst",              isLead: false, hireYear: 2024 },
  // PRD-DS (5)
  { deptCode: "PRD", teamCode: "PRD-DS",   positionTitle: "Product Manager",               isLead: true,  hireYear: 2021 },
  { deptCode: "PRD", teamCode: "PRD-DS",   positionTitle: "UX Lead",                       isLead: false, hireYear: 2022 },
  { deptCode: "PRD", teamCode: "PRD-DS",   positionTitle: "UX Designer",                   isLead: false, hireYear: 2023 },
  { deptCode: "PRD", teamCode: "PRD-DS",   positionTitle: "UX Designer",                   isLead: false, hireYear: 2024 },
  { deptCode: "PRD", teamCode: "PRD-DS",   positionTitle: "Product Owner",                 isLead: false, hireYear: 2022 },
  // FIN-CTRL (8)
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Finance Manager",               isLead: true,  hireYear: 2020 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Financial Controller",          isLead: false, hireYear: 2021 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Financial Controller",          isLead: false, hireYear: 2022 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Accountant",                    isLead: false, hireYear: 2022 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Accountant",                    isLead: false, hireYear: 2023 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Junior Accountant",             isLead: false, hireYear: 2023 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Junior Accountant",             isLead: false, hireYear: 2024 },
  { deptCode: "FIN", teamCode: "FIN-CTRL", positionTitle: "Tax Specialist",                isLead: false, hireYear: 2022 },
  // FIN-FPA (7)
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "FP&A Manager",                  isLead: true,  hireYear: 2020 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Financial Analyst",             isLead: false, hireYear: 2021 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Financial Analyst",             isLead: false, hireYear: 2022 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Senior Financial Analyst",      isLead: false, hireYear: 2022 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Senior Financial Analyst",      isLead: false, hireYear: 2023 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Junior Analyst",                isLead: false, hireYear: 2023 },
  { deptCode: "FIN", teamCode: "FIN-FPA",  positionTitle: "Junior Analyst",                isLead: false, hireYear: 2024 },
  // SAL-ENT (6)
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Sales Manager",                 isLead: true,  hireYear: 2020 },
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Senior AE",                     isLead: false, hireYear: 2021 },
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Senior AE",                     isLead: false, hireYear: 2022 },
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Enterprise AE",                 isLead: false, hireYear: 2022 },
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Enterprise AE",                 isLead: false, hireYear: 2023 },
  { deptCode: "SAL", teamCode: "SAL-ENT",  positionTitle: "Sales Engineer",                isLead: false, hireYear: 2023 },
  // SAL-SMB (6)
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Sales Manager",                 isLead: true,  hireYear: 2021 },
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Account Manager",               isLead: false, hireYear: 2022 },
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Account Manager",               isLead: false, hireYear: 2023 },
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Sales Development Rep",         isLead: false, hireYear: 2023 },
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Sales Development Rep",         isLead: false, hireYear: 2024 },
  { deptCode: "SAL", teamCode: "SAL-SMB",  positionTitle: "Sales Coordinator",             isLead: false, hireYear: 2024 },
];

const SKILLS_CATALOG: Array<{ name: string; domain: SkillDomain }> = [
  { name: "TypeScript",         domain: SkillDomain.TECHNICAL },
  { name: "React",              domain: SkillDomain.TECHNICAL },
  { name: "Vue.js",             domain: SkillDomain.TECHNICAL },
  { name: "Angular",            domain: SkillDomain.TECHNICAL },
  { name: "CSS/Tailwind",       domain: SkillDomain.TECHNICAL },
  { name: "Node.js",            domain: SkillDomain.TECHNICAL },
  { name: "NestJS",             domain: SkillDomain.TECHNICAL },
  { name: "Python",             domain: SkillDomain.TECHNICAL },
  { name: "Java",               domain: SkillDomain.TECHNICAL },
  { name: "Go",                 domain: SkillDomain.TECHNICAL },
  { name: "GraphQL",            domain: SkillDomain.TECHNICAL },
  { name: "AWS",                domain: SkillDomain.TECHNICAL },
  { name: "Azure",              domain: SkillDomain.TECHNICAL },
  { name: "GCP",                domain: SkillDomain.TECHNICAL },
  { name: "Terraform",          domain: SkillDomain.TECHNICAL },
  { name: "Linux",              domain: SkillDomain.TECHNICAL },
  { name: "CI/CD",              domain: SkillDomain.TECHNICAL },
  { name: "Git",                domain: SkillDomain.TECHNICAL },
  { name: "Redis",              domain: SkillDomain.TECHNICAL },
  { name: "MongoDB",            domain: SkillDomain.TECHNICAL },
  { name: "Elasticsearch",      domain: SkillDomain.TECHNICAL },
  { name: "Kafka",              domain: SkillDomain.TECHNICAL },
  { name: "Docker",             domain: SkillDomain.TECHNICAL },
  { name: "Kubernetes",         domain: SkillDomain.TECHNICAL },
  { name: "PostgreSQL",         domain: SkillDomain.TECHNICAL },
  { name: "Figma",              domain: SkillDomain.TECHNICAL },
  { name: "UX Research",        domain: SkillDomain.TECHNICAL },
  { name: "Adobe XD",           domain: SkillDomain.TECHNICAL },
  { name: "Data Analysis",      domain: SkillDomain.TECHNICAL },
  { name: "Leadership",         domain: SkillDomain.LEADERSHIP },
  { name: "Mentoring",          domain: SkillDomain.LEADERSHIP },
  { name: "Communication",      domain: SkillDomain.SOFT_SKILLS },
  { name: "Agile/Scrum",        domain: SkillDomain.SOFT_SKILLS },
  { name: "Project Management", domain: SkillDomain.SOFT_SKILLS },
  { name: "Negotiation",        domain: SkillDomain.SOFT_SKILLS },
  { name: "English",            domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "French",             domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Arabic",             domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Spanish",            domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "German",             domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Chinese",            domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Financial Analysis", domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "IFRS Accounting",    domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Tax Law",            domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "FP&A",               domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Budget Planning",    domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "SAP/ERP",            domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "CRM/Salesforce",     domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "Recruitment",        domain: SkillDomain.DOMAIN_EXPERTISE },
  { name: "L&D Design",         domain: SkillDomain.DOMAIN_EXPERTISE },
];

const TEAM_SKILLS: Record<string, string[]> = {
  "ENG-BE":   ["TypeScript", "Node.js", "NestJS", "PostgreSQL", "Docker", "Git", "Redis", "AWS", "CI/CD", "Python", "Go", "Kafka", "GraphQL"],
  "ENG-FE":   ["TypeScript", "React", "Vue.js", "CSS/Tailwind", "Git", "Docker", "Figma", "AWS", "Angular"],
  "HR-TA":    ["Communication", "Leadership", "Mentoring", "Negotiation", "English", "French", "Project Management", "Recruitment"],
  "HR-LD":    ["Communication", "Leadership", "Mentoring", "English", "French", "Agile/Scrum", "Project Management", "L&D Design"],
  "PRD-PS":   ["Project Management", "Agile/Scrum", "Data Analysis", "Communication", "Leadership", "English", "Figma"],
  "PRD-DS":   ["Figma", "UX Research", "Adobe XD", "Communication", "Agile/Scrum", "English", "CSS/Tailwind"],
  "FIN-CTRL": ["Financial Analysis", "IFRS Accounting", "SAP/ERP", "Tax Law", "Budget Planning", "Communication", "English"],
  "FIN-FPA":  ["Financial Analysis", "FP&A", "Data Analysis", "Budget Planning", "SAP/ERP", "Communication", "English"],
  "SAL-ENT":  ["CRM/Salesforce", "Negotiation", "Communication", "English", "Project Management"],
  "SAL-SMB":  ["CRM/Salesforce", "Negotiation", "Communication", "English"],
};

const FIRST_NAMES = [
  "Maya","Ethan","Aisha","Liam","Nora","Mateo","Zoe","Owen","Amara","Noah",
  "Leah","Julian","Iris","Caleb","Priya","Felix","Sofia","Miles","Hana","Elias",
  "Naomi","Theo","Lina","Adrian","Mila","Jonah","Talia","Isaac","Rina","Gabriel",
  "Layla","Simon","Elena","Rafael","Chloe","Dylan","Miriam","Aaron","Avery","Leo",
  "Selena","Nathan","Kiara","Oscar","Grace","Daniel","Imani","Victor","Clara","Samuel",
];
const LAST_NAMES = [
  "Bennett","Okafor","Chen","Haddad","Singh","Morgan","Alvarez","Peterson","Nakamura","Reed",
  "Mensah","Khan","Brooks","Silva","Morrison","Ibrahim","Foster","Vargas","Nguyen","Coleman",
  "Rahman","Price","Dubois","Bishop","Park","Hughes","Costa","Santos","Wallace","Fletcher",
  "Mehta","Carter","Jensen","Adebayo","Stone","Farouk","Cooper","Sullivan","Rossi","Hart",
  "Kimani","Patel","Hayes","Mendoza","Wright","Bakker","Diallo","Quinn","Meyer","Powell",
  "Salazar","Ndiaye","Turner",
];

// ============================================================
// HELPERS
// ============================================================

function buildHireDate(year: number, slotIdx: number): Date {
  return new Date(year, (slotIdx * 2) % 12, (slotIdx * 7) % 25 + 1);
}

function applyJitter(base: number, idx: number): number {
  const pct = ((idx % 10) - 5) * 0.01; // ±5%
  return Math.round(base * (1 + pct));
}

function resolveStatus(slot: EmpSlot, globalIdx: number): EmploymentStatus {
  // leads are always active — they're department/team heads
  if (slot.isLead) return EmploymentStatus.ACTIVE;
  if (globalIdx % 13 === 7) return EmploymentStatus.TERMINATED;
  if (globalIdx % 17 === 3) return EmploymentStatus.RESIGNED;
  if (globalIdx % 33 === 5) return EmploymentStatus.ON_LEAVE;
  if (slot.hireYear >= 2024 && globalIdx % 11 === 4) return EmploymentStatus.PROBATION;
  return EmploymentStatus.ACTIVE;
}

function resolveContractType(slot: EmpSlot, globalIdx: number): ContractType {
  const junior = slot.positionTitle.includes("Junior") ||
                 slot.positionTitle.includes("Coordinator") ||
                 slot.positionTitle.includes("Development Rep");
  if (junior) {
    const r = globalIdx % 3;
    if (r === 0) return ContractType.FIXED_TERM;
    if (r === 1) return ContractType.INTERN;
  }
  return ContractType.FULL_TIME;
}

function resolveMaritalStatus(idx: number): MaritalStatus {
  const statuses = [
    MaritalStatus.SINGLE,
    MaritalStatus.MARRIED,
    MaritalStatus.MARRIED,
    MaritalStatus.SINGLE,
    MaritalStatus.DIVORCED,
    MaritalStatus.MARRIED,
    MaritalStatus.SINGLE,
    MaritalStatus.WIDOWED,
  ];
  return statuses[idx % statuses.length]!;
}

function resolveGender(idx: number): Gender {
  const genders = [
    Gender.FEMALE,
    Gender.MALE,
    Gender.FEMALE,
    Gender.MALE,
    Gender.FEMALE,
    Gender.MALE,
    Gender.NON_BINARY,
    Gender.FEMALE,
    Gender.MALE,
    Gender.PREFER_NOT_TO_SAY,
  ];
  return genders[idx % genders.length]!;
}

function resolveEducationLevel(posTitle: string): EducationLevel {
  const senior = posTitle.includes("Manager") || posTitle.includes("Lead") || posTitle.includes("Partner") || posTitle.includes("Controller") || posTitle.includes("Senior");
  if (senior) return EducationLevel.MASTER;
  return EducationLevel.BACHELOR;
}

function resolveEducationField(deptCode: string): string {
  const map: Record<string, string> = {
    ENG: "Computer Science",
    HR:  "Human Resources Management",
    PRD: "Business / UX",
    FIN: "Finance",
    SAL: "Business Administration",
  };
  return map[deptCode] ?? "Business Administration";
}

function resolveBaseSalary(posTitle: string, buCode: string): number {
  const bc = BU_CONFIGS.find(b => b.code === buCode)!;
  const t  = bc.salaryTiers;
  const title = posTitle.toLowerCase();
  if (title.includes("junior") || title.includes("coordinator") || title.includes("development rep")) return t.jr;
  if (title.includes("manager") || title.includes("lead") || title.includes("controller") || title.includes("partner") || title.includes("senior") || title.includes("fpa manager") || title.includes("fp&a manager")) return t.sr;
  return t.mid;
}

function getEmployeeName(idx: number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[idx % FIRST_NAMES.length]!,
    lastName: LAST_NAMES[(idx * 7) % LAST_NAMES.length]!,
  };
}

function buildDateOfBirth(idx: number): Date {
  const birthDate = new Date(1970, 0, 15);
  birthDate.setDate(birthDate.getDate() + ((idx * 211) % 10220));
  return birthDate;
}

function resolveNetSalary(grossSalary: number, idx: number): number {
  const retentionRate = 0.72 + ((idx % 8) * 0.01);
  return Math.round(grossSalary * retentionRate * 100) / 100;
}

function subDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - days);
  return r;
}

// ============================================================
// PHASE 0 — RESET
// ============================================================

async function resetDatabase(): Promise<void> {
  console.log("  → Truncating all hr_core tables...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      hr_core.performance_review_salary_followups,
      hr_core.performance_review_audits,
      hr_core.performance_reviews,
      hr_core.performance_review_cycles,
      hr_core.skill_history,
      hr_core.employee_skills,
      hr_core.position_skills,
      hr_core.leave_requests,
      hr_core.leave_balance_adjustments,
      hr_core.leave_balances,
      hr_core.leave_accrual_runs,
      hr_core.salary_history,
      hr_core.user_roles,
      hr_core.role_permissions,
      hr_core.sessions,
      hr_core.password_reset_tokens,
      hr_core.invite_tokens,
      hr_core.security_events,
      hr_core.users,
      hr_core.employees,
      hr_core.roles,
      hr_core.permissions,
      hr_core.teams,
      hr_core.departments,
      hr_core.positions,
      hr_core.skills,
      hr_core.leave_types,
      hr_core.holidays,
      hr_core.business_units,
      hr_core.enum_meta
    RESTART IDENTITY CASCADE
  `);
}

// ============================================================
// PHASE 1 — IAM
// ============================================================

async function seedIam(): Promise<Map<string, string>> {
  console.log("  → Seeding IAM (roles, permissions, enum meta)...");

  const RESOURCES = [
    "employee","leave_request","leave_balance","leave_type","skill",
    "salary_history","performance_review","department","team","position","holiday","user","role",
  ];
  const ACTIONS = [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE, PermissionAction.DELETE, PermissionAction.APPROVE];
  const SCOPES  = [PermissionScope.OWN, PermissionScope.TEAM, PermissionScope.DEPARTMENT, PermissionScope.BUSINESS_UNIT, PermissionScope.GLOBAL];

  const permRows: Prisma.PermissionCreateManyInput[] = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      for (const scope of SCOPES) {
        permRows.push({ resource, action, scope });
      }
    }
  }
  await prisma.permission.createMany({ data: permRows, skipDuplicates: true });
  const allPerms = await prisma.permission.findMany();

  function permsFor(resource: string, actions: PermissionAction[], scope: PermissionScope) {
    return allPerms
      .filter(p => p.resource === resource && actions.includes(p.action) && p.scope === scope)
      .map(p => p.id);
  }

  const roleDefs = [
    {
      code: "SYSTEM_ADMIN", name: "System Administrator", isSystem: true, isEditable: false,
      permIds: allPerms.map(p => p.id),
    },
    {
      code: "HR_ADMIN", name: "HR Administrator", isSystem: true, isEditable: false,
      permIds: allPerms.filter(p => p.scope === PermissionScope.GLOBAL).map(p => p.id),
    },
    {
      code: "MANAGER", name: "Manager", isSystem: true, isEditable: false,
      permIds: [
        ...permsFor("employee",           [PermissionAction.READ, PermissionAction.UPDATE],              PermissionScope.TEAM),
        ...permsFor("leave_request",      [PermissionAction.READ, PermissionAction.APPROVE],             PermissionScope.TEAM),
        ...permsFor("performance_review", [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], PermissionScope.TEAM),
        ...permsFor("leave_balance",      [PermissionAction.READ],                                       PermissionScope.TEAM),
        ...permsFor("skill",              [PermissionAction.READ, PermissionAction.UPDATE],              PermissionScope.TEAM),
      ],
    },
    {
      code: "TEAM_LEAD", name: "Team Lead", isSystem: true, isEditable: false,
      permIds: [
        ...permsFor("employee",           [PermissionAction.READ, PermissionAction.UPDATE],              PermissionScope.TEAM),
        ...permsFor("leave_request",      [PermissionAction.READ, PermissionAction.APPROVE],             PermissionScope.TEAM),
        ...permsFor("performance_review", [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE], PermissionScope.TEAM),
        ...permsFor("leave_balance",      [PermissionAction.READ],                                       PermissionScope.TEAM),
        ...permsFor("skill",              [PermissionAction.READ, PermissionAction.UPDATE],              PermissionScope.TEAM),
      ],
    },
    {
      code: "EMPLOYEE", name: "Employee", isSystem: true, isEditable: false,
      permIds: [
        ...permsFor("employee",           [PermissionAction.READ, PermissionAction.UPDATE],              PermissionScope.OWN),
        ...permsFor("leave_request",      [PermissionAction.CREATE, PermissionAction.READ],              PermissionScope.OWN),
        ...permsFor("leave_balance",      [PermissionAction.READ],                                       PermissionScope.OWN),
        ...permsFor("skill",              [PermissionAction.READ],                                        PermissionScope.OWN),
        ...permsFor("performance_review", [PermissionAction.READ],                                        PermissionScope.OWN),
      ],
    },
    {
      code: "EXECUTIVE", name: "Executive", isSystem: true, isEditable: false,
      permIds: allPerms.filter(p => p.action === PermissionAction.READ && p.scope === PermissionScope.GLOBAL).map(p => p.id),
    },
  ];

  const roleMap = new Map<string, string>();
  for (const rd of roleDefs) {
    const role = await prisma.role.upsert({
      where:  { code: rd.code },
      update: {},
      create: { code: rd.code, name: rd.name, isSystem: rd.isSystem, isEditable: rd.isEditable },
    });
    roleMap.set(rd.code, role.id);
    const unique = [...new Set(rd.permIds)];
    await prisma.rolePermission.createMany({
      data: unique.map(permId => ({ roleId: role.id, permissionId: permId })),
      skipDuplicates: true,
    });
  }

  // Enum meta
  const metaRows: Prisma.EnumMetaCreateManyInput[] = [
    ...Object.values(PositionLevel).map((k, i)    => ({ enumName: "PositionLevel",    key: k, rank: i + 1, label: k.replace(/_/g, " ") })),
    ...Object.values(ProficiencyLevel).map((k, i)  => ({ enumName: "ProficiencyLevel", key: k, rank: i + 1, label: k.charAt(0) + k.slice(1).toLowerCase() })),
    ...Object.values(EmploymentStatus).map((k, i)  => ({ enumName: "EmploymentStatus", key: k, rank: i + 1, label: k.replace(/_/g, " ") })),
    ...Object.values(SkillDomain).map((k, i)       => ({ enumName: "SkillDomain",      key: k, rank: i + 1, label: k.replace(/_/g, " ") })),
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
  await prisma.enumMeta.createMany({ data: metaRows, skipDuplicates: true });

  return roleMap;
}

// ============================================================
// PHASE 1 — FOUNDATION
// ============================================================

interface FoundationMaps {
  buMap:        Map<string, string>; // buName  → id
  deptMap:      Map<string, string>; // "buCode-deptCode" → id
  teamMap:      Map<string, string>; // "buCode-teamCode" → id
  posMap:       Map<string, string>; // positionTitle → id
  skillMap:     Map<string, string>; // skillName → id
  leaveTypeMap: Map<string, Map<string, string>>; // buId → ltName → id
}

async function seedFoundation(): Promise<FoundationMaps> {
  console.log("  → Seeding foundation (BUs, depts, teams, positions, skills, leave types)...");

  // -- Business Units --
  const buMap = new Map<string, string>();
  for (const bc of BU_CONFIGS) {
    const bu = await prisma.businessUnit.upsert({
      where:  { name: bc.name },
      update: { address: bc.address },
      create: { name: bc.name, address: bc.address },
    });
    buMap.set(bc.name, bu.id);
  }

  // -- Departments (one set per BU) --
  const deptMap = new Map<string, string>();
  for (const bc of BU_CONFIGS) {
    const buId = buMap.get(bc.name)!;
    for (const dd of DEPT_DEFS) {
      const deptCode = `${bc.code}-${dd.code}`;
      const dept = await prisma.department.upsert({
        where: { code_businessUnitId: { code: deptCode, businessUnitId: buId } },
        update: {},
        create: { name: dd.name, code: deptCode, description: dd.description, businessUnitId: buId },
      });
      deptMap.set(deptCode, dept.id);
    }
  }

  // -- Teams (one set per BU) --
  const teamMap = new Map<string, string>();
  for (const bc of BU_CONFIGS) {
    const buId = buMap.get(bc.name)!;
    for (const td of TEAM_DEFS) {
      const teamCode = `${bc.code}-${td.code}`;
      const deptKey  = `${bc.code}-${td.deptCode}`;
      const deptId   = deptMap.get(deptKey)!;
      const team = await prisma.team.upsert({
        where: { code_businessUnitId: { code: teamCode, businessUnitId: buId } },
        update: {},
        create: { name: td.name, code: teamCode, departmentId: deptId, businessUnitId: buId },
      });
      teamMap.set(teamCode, team.id);
    }
  }

  // -- Positions --
  const positionDefs = [
    { title: "Chief Executive Officer",       level: PositionLevel.EXPERT,    isKey: true,  risk: KeyPositionRisk.HIGH   },
    { title: "Engineering Manager",           level: PositionLevel.SENIOR_2,  isKey: true,  risk: KeyPositionRisk.HIGH   },
    { title: "Technical Lead",                level: PositionLevel.SENIOR_2,  isKey: true,  risk: KeyPositionRisk.HIGH   },
    { title: "Software Engineer - Senior I",  level: PositionLevel.SENIOR_1,  isKey: false, risk: null },
    { title: "Software Engineer - Confirmed", level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Software Engineer - Medium",    level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Software Engineer - Junior",    level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "Frontend Engineer - Senior I",  level: PositionLevel.SENIOR_1,  isKey: false, risk: null },
    { title: "Frontend Engineer - Confirmed", level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Frontend Engineer - Medium",    level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Frontend Engineer - Junior",    level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "QA Engineer",                   level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "DevOps Engineer",               level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "HR Business Partner",           level: PositionLevel.SENIOR_1,  isKey: true,  risk: KeyPositionRisk.MEDIUM },
    { title: "HR Generalist",                 level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Recruiter",                     level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "L&D Specialist",                level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Product Manager",               level: PositionLevel.SENIOR_1,  isKey: true,  risk: KeyPositionRisk.MEDIUM },
    { title: "Product Owner",                 level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "UX Lead",                       level: PositionLevel.SENIOR_1,  isKey: false, risk: null },
    { title: "UX Designer",                   level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Business Analyst",              level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Finance Manager",               level: PositionLevel.SENIOR_2,  isKey: true,  risk: KeyPositionRisk.HIGH   },
    { title: "FP&A Manager",                  level: PositionLevel.SENIOR_1,  isKey: true,  risk: KeyPositionRisk.MEDIUM },
    { title: "Financial Controller",          level: PositionLevel.SENIOR_1,  isKey: false, risk: null },
    { title: "Senior Financial Analyst",      level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Accountant",                    level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Junior Accountant",             level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "Tax Specialist",                level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Financial Analyst",             level: PositionLevel.MEDIUM,    isKey: false, risk: null },
    { title: "Junior Analyst",                level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "Sales Manager",                 level: PositionLevel.SENIOR_1,  isKey: true,  risk: KeyPositionRisk.MEDIUM },
    { title: "Enterprise AE",                 level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Senior AE",                     level: PositionLevel.SENIOR_1,  isKey: false, risk: null },
    { title: "Sales Development Rep",         level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "Account Manager",               level: PositionLevel.CONFIRMED, isKey: false, risk: null },
    { title: "Sales Coordinator",             level: PositionLevel.JUNIOR,    isKey: false, risk: null },
    { title: "Sales Engineer",                level: PositionLevel.CONFIRMED, isKey: false, risk: null },
  ];

  const posMap = new Map<string, string>();
  for (const pd of positionDefs) {
    const pos = await prisma.position.upsert({
      where:  { title: pd.title },
      update: { level: pd.level, isKeyPosition: pd.isKey, keyPositionRisk: pd.risk },
      create: { title: pd.title, level: pd.level, isKeyPosition: pd.isKey, keyPositionRisk: pd.risk },
    });
    posMap.set(pd.title, pos.id);
  }

  // -- Skills --
  const skillMap = new Map<string, string>();
  for (const sd of SKILLS_CATALOG) {
    const skill = await prisma.skill.upsert({
      where:  { name: sd.name },
      update: { domain: sd.domain },
      create: { name: sd.name, domain: sd.domain },
    });
    skillMap.set(sd.name, skill.id);
  }

  // -- Leave Types + Holidays per BU --
  const leaveTypeMap = new Map<string, Map<string, string>>();
  const ltDefs = [
    { name: "Annual Leave",    days: 22, freq: AccrualFrequency.MONTHLY, carryover: 5,  approval: true,  color: "#4CAF50" },
    { name: "Sick Leave",      days: 10, freq: AccrualFrequency.YEARLY,  carryover: 0,  approval: false, color: "#F44336" },
    { name: "Maternity Leave", days: 98, freq: AccrualFrequency.YEARLY,  carryover: 0,  approval: true,  color: "#E91E63" },
    { name: "Paternity Leave", days: 5,  freq: AccrualFrequency.YEARLY,  carryover: 0,  approval: true,  color: "#2196F3" },
    { name: "Unpaid Leave",    days: 30, freq: AccrualFrequency.YEARLY,  carryover: 0,  approval: true,  color: "#9E9E9E" },
  ];

  for (const bc of BU_CONFIGS) {
    const buId = buMap.get(bc.name)!;
    const buLtMap = new Map<string, string>();
    for (const ltd of ltDefs) {
      const lt = await prisma.leaveType.upsert({
        where:  { name_businessUnitId: { name: ltd.name, businessUnitId: buId } },
        update: {},
        create: {
          name: ltd.name, businessUnitId: buId,
          defaultDaysPerYear: ltd.days, accrualFrequency: ltd.freq,
          maxCarryoverDays: ltd.carryover, requiresApproval: ltd.approval, color: ltd.color,
        },
      });
      buLtMap.set(ltd.name, lt.id);
    }
    leaveTypeMap.set(buId, buLtMap);

    // Holidays
    const hDefs = bc.code === "HQ"
      ? [
          { name: "New Year's Day",   m: 1,  d: 1  },
          { name: "Labour Day",       m: 5,  d: 1  },
          { name: "Independence Day", m: 7,  d: 5  },
          { name: "Revolution Day",   m: 11, d: 1  },
        ]
      : [
          { name: "New Year's Day",   m: 1,  d: 1  },
          { name: "Labour Day",       m: 5,  d: 1  },
          { name: "Christmas Day",    m: 12, d: 25 },
          { name: "National Holiday", m: 12, d: 26 },
        ];

    for (const year of [2024, 2025, 2026]) {
      for (const h of hDefs) {
        const date = new Date(year, h.m - 1, h.d);
        await prisma.holiday.upsert({
          where:  { date_businessUnitId_year: { date, businessUnitId: buId, year } },
          update: {},
          create: { name: h.name, date, businessUnitId: buId, year, isRecurring: true },
        });
      }
    }
  }

  return { buMap, deptMap, teamMap, posMap, skillMap, leaveTypeMap };
}

// ============================================================
// PHASE 2 — POSITION SKILLS
// ============================================================

async function seedPositionSkills(posMap: Map<string, string>, skillMap: Map<string, string>): Promise<void> {
  console.log("  → Seeding position skills (radar chart requirements)...");

  const reqs: Array<{ pos: string; skill: string; req: SkillRequirementLevel; min: ProficiencyLevel }> = [
    { pos: "Engineering Manager",           skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Engineering Manager",           skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Engineering Manager",           skill: "Agile/Scrum",        req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Engineering Manager",           skill: "TypeScript",         req: SkillRequirementLevel.NICE_TO_HAVE, min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Technical Lead",                skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Technical Lead",                skill: "TypeScript",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.EXPERT },
    { pos: "Technical Lead",                skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Software Engineer - Senior I",  skill: "TypeScript",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Software Engineer - Senior I",  skill: "Git",                req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Software Engineer - Senior I",  skill: "PostgreSQL",         req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Software Engineer - Senior I",  skill: "Communication",      req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Software Engineer - Confirmed", skill: "TypeScript",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Software Engineer - Confirmed", skill: "Git",                req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Software Engineer - Junior",    skill: "TypeScript",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.BEGINNER },
    { pos: "Software Engineer - Junior",    skill: "Git",                req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.BEGINNER },
    { pos: "Frontend Engineer - Senior I",  skill: "React",              req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Frontend Engineer - Senior I",  skill: "TypeScript",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Frontend Engineer - Senior I",  skill: "CSS/Tailwind",       req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "HR Business Partner",           skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "HR Business Partner",           skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "HR Business Partner",           skill: "Negotiation",        req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "HR Generalist",                 skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "HR Generalist",                 skill: "Project Management", req: SkillRequirementLevel.NICE_TO_HAVE, min: ProficiencyLevel.BEGINNER },
    { pos: "Product Manager",               skill: "Agile/Scrum",        req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Product Manager",               skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Product Manager",               skill: "Figma",              req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Product Manager",               skill: "Data Analysis",      req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Product Owner",                 skill: "Agile/Scrum",        req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Product Owner",                 skill: "Communication",      req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Finance Manager",               skill: "Financial Analysis", req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.EXPERT },
    { pos: "Finance Manager",               skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Finance Manager",               skill: "Budget Planning",    req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Finance Manager",               skill: "IFRS Accounting",    req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.ADVANCED },
    { pos: "FP&A Manager",                  skill: "Financial Analysis", req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.EXPERT },
    { pos: "FP&A Manager",                  skill: "FP&A",               req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.EXPERT },
    { pos: "FP&A Manager",                  skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Financial Controller",          skill: "Financial Analysis", req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Financial Controller",          skill: "IFRS Accounting",    req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Accountant",                    skill: "Financial Analysis", req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Accountant",                    skill: "SAP/ERP",            req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.BEGINNER },
    { pos: "Sales Manager",                 skill: "CRM/Salesforce",     req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Sales Manager",                 skill: "Leadership",         req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Sales Manager",                 skill: "Negotiation",        req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "Enterprise AE",                 skill: "CRM/Salesforce",     req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "Enterprise AE",                 skill: "Negotiation",        req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "UX Designer",                   skill: "Figma",              req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.INTERMEDIATE },
    { pos: "UX Designer",                   skill: "UX Research",        req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
    { pos: "UX Lead",                       skill: "Figma",              req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "UX Lead",                       skill: "UX Research",        req: SkillRequirementLevel.MANDATORY,    min: ProficiencyLevel.ADVANCED },
    { pos: "UX Lead",                       skill: "Leadership",         req: SkillRequirementLevel.EXPECTED,     min: ProficiencyLevel.INTERMEDIATE },
  ];

  for (const r of reqs) {
    const posId   = posMap.get(r.pos);
    const skillId = skillMap.get(r.skill);
    if (!posId || !skillId) continue;
    await prisma.positionSkill.upsert({
      where:  { positionId_skillId: { positionId: posId, skillId } },
      update: { minimumProficiency: r.min, requirementLevel: r.req },
      create: { positionId: posId, skillId, minimumProficiency: r.min, requirementLevel: r.req },
    });
  }
}

// ============================================================
// PHASE 3 — EMPLOYEES
// ============================================================

interface BulkEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: Date;
  hireYear: number;
  employmentStatus: EmploymentStatus;
  positionTitle: string;
  positionId: string | undefined;
  deptCode: string;
  teamCode: string;
  departmentId: string;
  teamId: string;
  managerId: string | null;
  grossSalary: number;
  buId: string;
  buName: string;
  buCode: string;
  isLead: boolean;
  globalIdx: number;
}

async function seedExecutiveEmployee(f: FoundationMaps): Promise<void> {
  console.log("  -> Seeding CEO employee...");

  await prisma.employee.create({
    data: {
      employeeCode: "EMP-0000",
      firstName: "Amira",
      lastName: "Benyahia",
      email: "amira.benyahia@sentient.dev",
      phone: "+1-202-555-0100",
      dateOfBirth: new Date(1978, 4, 17),
      hireDate: new Date(2018, 0, 8),
      employmentStatus: EmploymentStatus.ACTIVE,
      contractType: ContractType.FULL_TIME,
      grossSalary: 185000,
      netSalary: 126950,
      gender: Gender.FEMALE,
      maritalStatus: MaritalStatus.MARRIED,
      educationLevel: EducationLevel.MASTER,
      educationField: "Business Administration",
      positionId: f.posMap.get("Chief Executive Officer") ?? null,
      departmentId: null,
      teamId: null,
      managerId: null,
    },
  });
}

async function seedBulkEmployees(f: FoundationMaps): Promise<BulkEmployee[]> {
  console.log("  → Seeding 200 employees...");

  const allEmployees: BulkEmployee[] = [];
  let globalIdx = 0;

  for (const bc of BU_CONFIGS) {
    const buId    = f.buMap.get(bc.name)!;
    const headcount = BU_HEADCOUNTS[bc.name]!;
    const slots   = EMP_SLOTS.slice(0, headcount);

    // Process leads first so non-leads can reference their managerId
    const leads    = slots.filter(s => s.isLead);
    const nonLeads = slots.filter(s => !s.isLead);
    const ordered  = [...leads, ...nonLeads];

    const buLeads = new Map<string, string>(); // teamCode (without buCode prefix) → empId

    let slotIdx = 0;
    for (const slot of ordered) {
      const teamCode = `${bc.code}-${slot.teamCode}`;
      const deptKey  = `${bc.code}-${slot.deptCode}`;
      const deptId   = f.deptMap.get(deptKey)!;
      const teamId   = f.teamMap.get(teamCode)!;
      const posId    = f.posMap.get(slot.positionTitle);
      const status   = resolveStatus(slot, globalIdx);
      const hireDate = buildHireDate(slot.hireYear, slotIdx);
      const base     = applyJitter(resolveBaseSalary(slot.positionTitle, bc.code), globalIdx);

      const { firstName, lastName } = getEmployeeName(globalIdx);
      const email     = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sentient.dev`;
      const empCode   = `EMP-${String(globalIdx + 1).padStart(4, "0")}`;
      const managerId = slot.isLead ? null : (buLeads.get(slot.teamCode) ?? null);

      const emp = await prisma.employee.create({
        data: {
          employeeCode: empCode,
          firstName,
          lastName,
          email,
          phone: `+1-202-555-${String(globalIdx + 100).padStart(4, "0")}`,
          dateOfBirth: buildDateOfBirth(globalIdx),
          hireDate,
          employmentStatus: status,
          contractType: resolveContractType(slot, globalIdx),
          grossSalary: base,
          netSalary: resolveNetSalary(base, globalIdx),
          gender: resolveGender(globalIdx),
          maritalStatus: resolveMaritalStatus(globalIdx),
          educationLevel: resolveEducationLevel(slot.positionTitle),
          educationField: resolveEducationField(slot.deptCode),
          positionId:    posId ?? null,
          departmentId:  deptId,
          teamId,
          managerId,
        },
      });

      if (slot.isLead) {
        buLeads.set(slot.teamCode, emp.id);
        // Set team leadId
        await prisma.team.update({ where: { id: teamId }, data: { leadId: emp.id } });
      }

      allEmployees.push({
        id: emp.id,
        firstName, lastName, email, hireDate,
        hireYear: slot.hireYear,
        employmentStatus: status,
        positionTitle: slot.positionTitle,
        positionId: posId,
        deptCode: slot.deptCode,
        teamCode: slot.teamCode,
        departmentId: deptId,
        teamId,
        managerId,
        grossSalary: base,
        buId, buName: bc.name, buCode: bc.code,
        isLead: slot.isLead,
        globalIdx,
      });

      globalIdx++;
      slotIdx++;
    }
  }

  // Set department headIds — first lead per dept per BU
  for (const bc of BU_CONFIGS) {
    for (const dd of DEPT_DEFS) {
      const deptKey = `${bc.code}-${dd.code}`;
      const deptId  = f.deptMap.get(deptKey)!;
      const head    = allEmployees.find(e => e.buCode === bc.code && e.deptCode === dd.code && e.isLead);
      if (head) {
        await prisma.department.update({ where: { id: deptId }, data: { headId: head.id } });
      }
    }
  }

  console.log(`     Created ${allEmployees.length} employees`);
  return allEmployees;
}

async function seedDemoUsers(employees: BulkEmployee[], roleMap: Map<string, string>): Promise<void> {
  console.log("  → Seeding demo users...");

  // Pick specific employees from HQ for demo accounts
  const hrAdminEmp  = employees.find(e => e.buCode === "HQ" && e.teamCode === "HR-TA"    && e.isLead)!;
  const managerEmp  = employees.find(e => e.buCode === "HQ" && e.teamCode === "ENG-BE"   && e.isLead)!;
  const teamLeadEmp = employees.find(e => e.buCode === "HQ" && e.teamCode === "ENG-FE"   && e.isLead)!;
  const empEmp      = employees.find(e => e.buCode === "HQ" && !e.isLead && e.employmentStatus === EmploymentStatus.ACTIVE)!;

  type RoleAssignment = { code: string; scope: PermissionScope; scopeEntityId?: string };

  const demos: Array<{ email: string; empId: string | undefined; assignments: RoleAssignment[] }> = [
    {
      email: "hradmin@sentient.dev",
      empId: hrAdminEmp?.id,
      assignments: [
        { code: "HR_ADMIN", scope: PermissionScope.GLOBAL },
        { code: "EMPLOYEE", scope: PermissionScope.OWN },
      ],
    },
    {
      email: "manager@sentient.dev",
      empId: managerEmp?.id,
      assignments: [
        { code: "MANAGER", scope: PermissionScope.DEPARTMENT, scopeEntityId: managerEmp?.departmentId },
        { code: "EMPLOYEE", scope: PermissionScope.OWN },
      ],
    },
    {
      email: "teamlead@sentient.dev",
      empId: teamLeadEmp?.id,
      assignments: [
        { code: "TEAM_LEAD", scope: PermissionScope.TEAM, scopeEntityId: teamLeadEmp?.teamId },
        { code: "EMPLOYEE", scope: PermissionScope.OWN },
      ],
    },
    {
      email: "employee@sentient.dev",
      empId: empEmp?.id,
      assignments: [
        { code: "EMPLOYEE", scope: PermissionScope.OWN },
      ],
    },
  ];

  const pwHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const d of demos) {
    if (!d.empId) continue;
    const user = await prisma.user.upsert({
      where:  { email: d.email },
      update: {},
      create: { email: d.email, passwordHash: pwHash, status: UserStatus.ACTIVE, employeeId: d.empId },
    });
    for (const assignment of d.assignments) {
      const roleId = roleMap.get(assignment.code);
      if (!roleId) continue;
      await prisma.userRole.createMany({
        data: [{
          userId: user.id,
          roleId,
          scope: assignment.scope,
          scopeEntityId: assignment.scopeEntityId ?? null,
        }],
        skipDuplicates: true,
      });
    }
  }
}

// ============================================================
// PHASE 4 — HISTORY
// ============================================================

async function seedSalaryHistory(employees: BulkEmployee[]): Promise<Map<string, string[]>> {
  console.log("  → Seeding salary history (3-year raises)...");
  const empSalaryIds = new Map<string, string[]>();

  for (const emp of employees) {
    // Terminated/resigned employees get no forward-looking raises
    if (emp.employmentStatus === EmploymentStatus.TERMINATED || emp.employmentStatus === EmploymentStatus.RESIGNED) continue;

    const yearsEmployed = 2026 - emp.hireYear;
    const numRaises     = Math.min(Math.max(1, yearsEmployed), 3);
    const ids: string[] = [];
    let salary = emp.grossSalary;
    let netSalary = resolveNetSalary(salary, emp.globalIdx);

    for (let r = 0; r < numRaises; r++) {
      const raiseYear = emp.hireYear + r + 1;
      if (raiseYear > 2026) break;
      const pct    = 3 + (emp.globalIdx % 7); // 3–9%
      const prev   = salary;
      const prevNet = netSalary;
      salary       = Math.round(salary * (1 + pct / 100));
      netSalary    = resolveNetSalary(salary, emp.globalIdx);
      const reason = r % 2 === 1 ? SalaryChangeReason.PROMOTION : SalaryChangeReason.ANNUAL_REVIEW;

      const sh = await prisma.salaryHistory.create({
        data: {
          employeeId:         emp.id,
          previousGrossSalary: prev,
          newGrossSalary:      salary,
          previousNetSalary:   prevNet,
          newNetSalary:        netSalary,
          grossRaisePercentage: pct,
          netRaisePercentage:   pct,
          effectiveDate:       new Date(raiseYear, 0, 1),
          reason,
          changedById: "seed-script",
        },
      });
      ids.push(sh.id);
    }
    // Update employee's current salary to the latest
    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        grossSalary: salary,
        netSalary,
      },
    });
    emp.grossSalary = salary;
    empSalaryIds.set(emp.id, ids);
  }
  return empSalaryIds;
}

async function seedSkillEvolution(employees: BulkEmployee[], skillMap: Map<string, string>): Promise<void> {
  console.log("  → Seeding skill evolution...");
  const LEVELS: ProficiencyLevel[] = [
    ProficiencyLevel.BEGINNER,
    ProficiencyLevel.INTERMEDIATE,
    ProficiencyLevel.ADVANCED,
    ProficiencyLevel.EXPERT,
  ];

  for (const emp of employees) {
    const pool = TEAM_SKILLS[emp.teamCode] ?? [];
    if (pool.length === 0) continue;

    const numSkills = 3 + (emp.globalIdx % 4); // 3–6
    const chosen    = pool.slice(0, Math.min(numSkills, pool.length));
    const yearsExp  = 2026 - emp.hireYear;

    for (let si = 0; si < chosen.length; si++) {
      const skillName = chosen[si]!;
      const skillId   = skillMap.get(skillName);
      if (!skillId) continue;

      const startIdx   = Math.min(Math.max(0, yearsExp - 2), 2);
      const currentIdx = Math.min(startIdx + 1 + (si % 2), 3);
      const current    = LEVELS[currentIdx]!;

      await prisma.employeeSkill.create({
        data: {
          employeeId:   emp.id,
          skillId,
          proficiency:  current,
          acquiredDate: new Date(emp.hireYear, si % 12, 1),
        },
      });

      // Progression history
      if (startIdx > 0) {
        await prisma.skillHistory.create({
          data: {
            employeeId:    emp.id,
            skillId,
            previousLevel: LEVELS[startIdx - 1]!,
            newLevel:      LEVELS[startIdx]!,
            effectiveDate: new Date(emp.hireYear + 1, (si * 2) % 12, 1),
            source:        SourceLevel.TRAINING,
          },
        });
      }
      if (currentIdx > startIdx) {
        await prisma.skillHistory.create({
          data: {
            employeeId:    emp.id,
            skillId,
            previousLevel: LEVELS[startIdx]!,
            newLevel:      current,
            effectiveDate: new Date(emp.hireYear + 2, (si * 3) % 12, 1),
            source:        SourceLevel.PEER_REVIEW,
          },
        });
      }
    }
  }
}

async function seedLeaveHistory(employees: BulkEmployee[], leaveTypeMap: Map<string, Map<string, string>>): Promise<void> {
  console.log("  → Seeding leave history (balances + requests)...");

  for (const emp of employees) {
    const buLtMap = leaveTypeMap.get(emp.buId);
    if (!buLtMap) continue;

    const annualLtId = buLtMap.get("Annual Leave");
    const sickLtId   = buLtMap.get("Sick Leave");
    if (!annualLtId || !sickLtId) continue;

    const startYear = Math.max(emp.hireYear, 2023);
    const endYear   = (emp.employmentStatus === EmploymentStatus.TERMINATED || emp.employmentStatus === EmploymentStatus.RESIGNED)
      ? 2025 : 2026;

    for (const year of [2023, 2024, 2025, 2026]) {
      if (year < startYear || year > endYear) continue;

      // Annual leave balance
      const usedDays  = 5 + (emp.globalIdx % 12); // 5–16 days used
      await prisma.leaveBalance.upsert({
        where:  { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: annualLtId, year } },
        update: {},
        create: { employeeId: emp.id, leaveTypeId: annualLtId, year, totalDays: 22, usedDays, pendingDays: 0 },
      });

      // Sick leave balance
      const sickUsed = emp.globalIdx % 4; // 0–3 days
      await prisma.leaveBalance.upsert({
        where:  { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: sickLtId, year } },
        update: {},
        create: { employeeId: emp.id, leaveTypeId: sickLtId, year, totalDays: 10, usedDays: sickUsed, pendingDays: 0 },
      });
    }

    // Leave requests for past years — APPROVED
    if (emp.employmentStatus === EmploymentStatus.TERMINATED || emp.employmentStatus === EmploymentStatus.RESIGNED) continue;

    for (const year of [2024, 2025]) {
      if (year < emp.hireYear) continue;
      const startDay  = 10 + (emp.globalIdx % 15);
      const startDate = new Date(year, (emp.globalIdx * 3) % 10, startDay);
      const endDate   = new Date(startDate);
      endDate.setDate(endDate.getDate() + 4);

      await prisma.leaveRequest.create({
        data: {
          employeeId:  emp.id,
          leaveTypeId: annualLtId,
          startDate,
          endDate,
          totalDays:   5,
          reason:      "Annual vacation",
          status:      LeaveStatus.APPROVED,
          reviewedAt:  new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          reviewedById: emp.managerId ?? emp.id,
        },
      });
    }
  }
}

// ============================================================
// PHASE 5 — PERFORMANCE REVIEWS
// ============================================================

async function seedPerformanceReviews(
  employees: BulkEmployee[],
  empSalaryIds: Map<string, string[]>,
  hrCreatorId: string,
): Promise<void> {
  console.log("  → Seeding performance review cycles (5 cycles)...");

  const CYCLE_DEFS = [
    {
      name: "Mid-Year Review 2024",   type: ReviewType.MID_YEAR, status: ReviewCycleStatus.CLOSED,
      periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-06-30"),
      selfOpen: new Date("2024-06-15T00:00:00.000Z"), selfClose: new Date("2024-06-30T23:59:59.000Z"),
      mgrDue:  new Date("2024-07-15T23:59:59.000Z"),
    },
    {
      name: "Annual Review 2024",     type: ReviewType.ANNUAL,   status: ReviewCycleStatus.CLOSED,
      periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31"),
      selfOpen: new Date("2024-12-01T00:00:00.000Z"), selfClose: new Date("2024-12-15T23:59:59.000Z"),
      mgrDue:  new Date("2024-12-31T23:59:59.000Z"),
    },
    {
      name: "Mid-Year Review 2025",   type: ReviewType.MID_YEAR, status: ReviewCycleStatus.CLOSED,
      periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-06-30"),
      selfOpen: new Date("2025-06-15T00:00:00.000Z"), selfClose: new Date("2025-06-30T23:59:59.000Z"),
      mgrDue:  new Date("2025-07-15T23:59:59.000Z"),
    },
    {
      name: "Annual Review 2025",     type: ReviewType.ANNUAL,   status: ReviewCycleStatus.CLOSED,
      periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"),
      selfOpen: new Date("2025-12-01T00:00:00.000Z"), selfClose: new Date("2025-12-15T23:59:59.000Z"),
      mgrDue:  new Date("2025-12-31T23:59:59.000Z"),
    },
    {
      name: "Annual Review 2026",     type: ReviewType.ANNUAL,   status: ReviewCycleStatus.ACTIVE,
      periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"),
      selfOpen: new Date("2026-05-01T00:00:00.000Z"), selfClose: new Date("2026-05-15T23:59:59.000Z"),
      mgrDue:  new Date("2026-05-31T23:59:59.000Z"),
    },
  ] as const;

  const RATINGS: PerformanceRating[] = [
    PerformanceRating.NEEDS_IMPROVEMENT,
    PerformanceRating.MEETS_EXPECTATIONS,
    PerformanceRating.MEETS_EXPECTATIONS,
    PerformanceRating.EXCEEDS_EXPECTATIONS,
    PerformanceRating.ABOVE_AND_BEYOND,
  ];

  const SATS: SatisfactionLevel[] = [
    SatisfactionLevel.DISSATISFIED,
    SatisfactionLevel.NEUTRAL,
    SatisfactionLevel.SATISFIED,
    SatisfactionLevel.SATISFIED,
    SatisfactionLevel.VERY_SATISFIED,
  ];

  const isHighRating = (r: PerformanceRating) =>
    r === PerformanceRating.EXCEEDS_EXPECTATIONS || r === PerformanceRating.ABOVE_AND_BEYOND;

  for (let ci = 0; ci < CYCLE_DEFS.length; ci++) {
    const cd = CYCLE_DEFS[ci]!;
    const isClosed = cd.status === ReviewCycleStatus.CLOSED;

    const cycle = await prisma.performanceReviewCycle.upsert({
      where: {
        reviewType_periodStart_periodEnd_name: {
          reviewType: cd.type,
          periodStart: cd.periodStart,
          periodEnd:   cd.periodEnd,
          name:        cd.name,
        },
      },
      update: {},
      create: {
        name:               cd.name,
        reviewType:         cd.type,
        periodStart:        cd.periodStart,
        periodEnd:          cd.periodEnd,
        selfReviewOpensAt:  cd.selfOpen,
        selfReviewClosesAt: cd.selfClose,
        managerReviewDueAt: cd.mgrDue,
        status:             cd.status,
        createdById:        hrCreatorId,
        closedAt:           isClosed ? cd.mgrDue : null,
      },
    });

    // Eligible employees: hired before periodStart + not terminated/resigned
    const eligible = employees.filter(
      e =>
        e.hireDate < cd.periodStart &&
        e.employmentStatus !== EmploymentStatus.TERMINATED &&
        e.employmentStatus !== EmploymentStatus.RESIGNED,
    );

    console.log(`     Cycle "${cd.name}": ${eligible.length} eligible employees`);

    for (let ei = 0; ei < eligible.length; ei++) {
      const emp = eligible[ei]!;

      const reviewerId    = emp.managerId ?? hrCreatorId;
      const selfRating    = RATINGS[(ei + ci) % 5]!;
      const managerRating = RATINGS[(ei + ci + 1) % 5]!;
      const reviewDate    = isClosed ? cd.selfClose : cd.selfOpen;
      const dueDate       = cd.mgrDue;

      // Determine review status
      let reviewStatus: ReviewStatus;
      let submittedAt: Date | null   = null;
      let completedAt: Date | null   = null;

      if (isClosed) {
        reviewStatus = ReviewStatus.COMPLETED;
        submittedAt  = subDays(cd.selfClose, 2);
        completedAt  = subDays(cd.mgrDue, 1);
      } else {
        // active cycle — 60% submitted, 40% pending
        if (ei % 5 < 3) {
          reviewStatus = ReviewStatus.SUBMITTED;
          submittedAt  = subDays(cd.selfClose, 2);
        } else {
          reviewStatus = ReviewStatus.PENDING;
        }
      }

      const review = await prisma.performanceReview.upsert({
        where:  { employeeId_cycleId: { employeeId: emp.id, cycleId: cycle.id } },
        update: {},
        create: {
          cycleId:      cycle.id,
          employeeId:   emp.id,
          reviewerId,
          reviewDate,
          dueDate,
          status:       reviewStatus,
          businessUnitId:   emp.buId,
          businessUnitName: emp.buName,
          departmentId:     emp.departmentId,
          teamId:           emp.teamId,
          positionId:       emp.positionId ?? null,
          positionTitle:    emp.positionTitle,
          // Self-review fields (completed + submitted)
          selfRating:   reviewStatus !== ReviewStatus.PENDING ? selfRating : null,
          managerRating: reviewStatus === ReviewStatus.COMPLETED ? managerRating : null,
          environmentSatisfaction:  reviewStatus !== ReviewStatus.PENDING ? SATS[(ei + 0) % 5]! : null,
          jobSatisfaction:          reviewStatus !== ReviewStatus.PENDING ? SATS[(ei + 1) % 5]! : null,
          relationshipSatisfaction: reviewStatus !== ReviewStatus.PENDING ? SATS[(ei + 2) % 5]! : null,
          workLifeBalance:          reviewStatus !== ReviewStatus.PENDING ? SATS[(ei + 3) % 5]! : null,
          trainingOpportunitiesTaken: reviewStatus !== ReviewStatus.PENDING ? (ei % 4) + 1 : null,
          submittedAt,
          submittedById: submittedAt ? emp.id : null,
          completedAt,
          completedById: completedAt ? reviewerId : null,
          employeeComments: reviewStatus !== ReviewStatus.PENDING
            ? "Good progress this period, focused on delivery and collaboration."
            : null,
          managerComments: reviewStatus === ReviewStatus.COMPLETED
            ? "Strong contribution to team goals. Continues to grow in their role."
            : null,
        },
      });

      // Audit trail
      const audits: Prisma.PerformanceReviewAuditCreateManyInput[] = [];

      // ASSIGNED — always
      audits.push({
        reviewId:  review.id,
        action:    PerformanceReviewAuditAction.ASSIGNED,
        actorId:   hrCreatorId,
        fromStatus: null,
        toStatus:  ReviewStatus.PENDING,
        createdAt: subDays(cd.selfOpen, 7),
      });

      if (reviewStatus === ReviewStatus.SUBMITTED || reviewStatus === ReviewStatus.COMPLETED) {
        audits.push({
          reviewId:   review.id,
          action:     PerformanceReviewAuditAction.SELF_SUBMITTED,
          actorId:    emp.id,
          fromStatus: ReviewStatus.PENDING,
          toStatus:   ReviewStatus.SUBMITTED,
          createdAt:  submittedAt!,
        });
      }

      if (reviewStatus === ReviewStatus.COMPLETED) {
        audits.push({
          reviewId:   review.id,
          action:     PerformanceReviewAuditAction.MANAGER_COMPLETED,
          actorId:    reviewerId,
          fromStatus: ReviewStatus.SUBMITTED,
          toStatus:   ReviewStatus.COMPLETED,
          createdAt:  completedAt!,
        });
      }

      await prisma.performanceReviewAudit.createMany({ data: audits });

      // Salary follow-ups: 20% of COMPLETED reviews with high manager rating
      if (reviewStatus === ReviewStatus.COMPLETED && ei % 5 === 0 && isHighRating(managerRating)) {
        const salaryIds = empSalaryIds.get(emp.id) ?? [];
        const salaryHistoryId = salaryIds[0] ?? null;
        if (salaryHistoryId) {
          await prisma.performanceReviewSalaryFollowUp.create({
            data: {
              reviewId:       review.id,
              salaryHistoryId,
              reason:         "Salary adjustment following exceptional performance review outcome.",
              createdById:    hrCreatorId,
            },
          });
        }
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log("\n🌱 Sentient HR Core — Full Seed (201 employees, 3-year history)\n");

  console.log("Phase 0: Resetting database...");
  await resetDatabase();

  console.log("Phase 1a: Seeding IAM...");
  const roleMap = await seedIam();

  console.log("Phase 1b: Seeding foundation...");
  const foundation = await seedFoundation();

  console.log("Phase 2: Seeding position skills...");
  await seedPositionSkills(foundation.posMap, foundation.skillMap);

  console.log("Phase 2b: Seeding executive root employee...");
  await seedExecutiveEmployee(foundation);

  console.log("Phase 3: Seeding employees...");
  const employees = await seedBulkEmployees(foundation);

  console.log("Phase 3b: Seeding demo users...");
  await seedDemoUsers(employees, roleMap);

  console.log("Phase 4a: Seeding salary history...");
  const empSalaryIds = await seedSalaryHistory(employees);

  console.log("Phase 4b: Seeding skill evolution...");
  await seedSkillEvolution(employees, foundation.skillMap);

  console.log("Phase 4c: Seeding leave history...");
  await seedLeaveHistory(employees, foundation.leaveTypeMap);

  console.log("Phase 5: Seeding performance reviews...");
  // Find the HR-TA lead in HQ as the cycle creator
  const hrCreator = employees.find(e => e.buCode === "HQ" && e.teamCode === "HR-TA" && e.isLead)!;
  await seedPerformanceReviews(employees, empSalaryIds, hrCreator.id);

  console.log("\n✅ Seed complete!\n");
  console.log("Demo accounts (password: Sentient@2026!):");
  console.log("  hradmin@sentient.dev  → HR_ADMIN");
  console.log("  manager@sentient.dev  → MANAGER");
  console.log("  teamlead@sentient.dev → MANAGER");
  console.log("  employee@sentient.dev → EMPLOYEE");
  console.log("");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
