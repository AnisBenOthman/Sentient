// ── Canonical Employee type ───────────────────────────────────────────────────
// Base shape matches the employees array. Optional schema-aligned fields are
// populated on wizard-created employees so they survive without needing a
// separate override lookup.
export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
  hireDate: string;
  salary: number;
  manager: string | null;
  managerId: string | null;
  buId: string;
  skills: { skill: string; level: number }[];
  // Schema-aligned optional fields (present on wizard-created employees)
  employmentStatus?: string; // ACTIVE | ON_LEAVE | PROBATION | TERMINATED | RESIGNED
  grossSalary?: number;
  netSalary?: number;
  phone?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  educationLevel?: string;
  educationField?: string;
  positionLevel?: string;
  contractType?: string;
  employeeCode?: string;
  team?: string;
};

export const currentUser = {
  id: "5",
  name: "Michael Realman",
  initials: "MR",
  email: "michael@example.com",
  role: "HR Admin",
  department: "HR",
};

export const employees = [
  {
    id: "0",
    name: "Sarah Chen",
    email: "sarah.chen@example.com",
    role: "CEO",
    department: "Executive",
    status: "active",
    hireDate: "2019-01-01",
    salary: 320000,
    manager: null,
    managerId: null,
    buId: "us-sea",
    skills: [
      { skill: "Strategy", level: 5 },
      { skill: "Leadership", level: 5 },
      { skill: "Communication", level: 5 },
      { skill: "Finance", level: 4 },
      { skill: "Operations", level: 4 },
    ],
  },
  {
    id: "1",
    name: "Eleanor Vance",
    email: "eleanor.vance@example.com",
    role: "VP of Engineering",
    department: "Engineering",
    status: "active",
    hireDate: "2021-03-15",
    salary: 185000,
    manager: "Sarah Chen",
    managerId: "0",
    buId: "us-sea",
    skills: [
      { skill: "Architecture", level: 5 },
      { skill: "Backend", level: 4 },
      { skill: "DevOps", level: 4 },
      { skill: "Leadership", level: 4 },
      { skill: "Testing", level: 4 },
      { skill: "Data", level: 4 },
    ],
  },
  {
    id: "2",
    name: "Chidi Anagonye",
    email: "chidi.anagonye@example.com",
    role: "Senior Backend Engineer",
    department: "Engineering",
    status: "active",
    hireDate: "2022-01-10",
    salary: 155000,
    manager: "Eleanor Vance",
    managerId: "1",
    buId: "in-blr",
    skills: [
      { skill: "Backend", level: 5 },
      { skill: "Architecture", level: 4 },
      { skill: "Testing", level: 4 },
      { skill: "DevOps", level: 3 },
      { skill: "Data", level: 4 },
      { skill: "Frontend", level: 2 },
    ],
  },
  {
    id: "3",
    name: "Tahani Al-Jamil",
    email: "tahani@example.com",
    role: "Director of Marketing",
    department: "Marketing",
    status: "active",
    hireDate: "2021-11-01",
    salary: 165000,
    manager: "Sarah Chen",
    managerId: "0",
    buId: "eu-dub",
    skills: [
      { skill: "Strategy", level: 5 },
      { skill: "Copywriting", level: 4 },
      { skill: "Analytics", level: 4 },
      { skill: "Social Media", level: 4 },
      { skill: "Design", level: 3 },
      { skill: "SEO", level: 4 },
    ],
  },
  {
    id: "4",
    name: "Jason Mendoza",
    email: "jason.mendoza@example.com",
    role: "Marketing Manager",
    department: "Marketing",
    status: "on-leave",
    hireDate: "2023-05-20",
    salary: 110000,
    manager: "Tahani Al-Jamil",
    managerId: "3",
    buId: "latam-sp",
    skills: [
      { skill: "Social Media", level: 5 },
      { skill: "Copywriting", level: 4 },
      { skill: "Analytics", level: 3 },
      { skill: "SEO", level: 3 },
      { skill: "Design", level: 4 },
      { skill: "Strategy", level: 3 },
    ],
  },
  {
    id: "5",
    name: "Michael Realman",
    email: "michael@example.com",
    role: "Head of HR",
    department: "HR",
    status: "active",
    hireDate: "2020-08-12",
    salary: 145000,
    manager: "Sarah Chen",
    managerId: "0",
    buId: "us-sea",
    skills: [
      { skill: "Recruiting", level: 4 },
      { skill: "Compliance", level: 4 },
      { skill: "Communication", level: 5 },
      { skill: "Analytics", level: 4 },
      { skill: "L&D", level: 4 },
      { skill: "Payroll", level: 4 },
    ],
  },
  {
    id: "6",
    name: "Janet",
    email: "janet@example.com",
    role: "People Operations Manager",
    department: "HR",
    status: "active",
    hireDate: "2020-01-01",
    salary: 95000,
    manager: "Michael Realman",
    managerId: "5",
    buId: "apac-sg",
    skills: [
      { skill: "Communication", level: 4 },
      { skill: "Payroll", level: 3 },
      { skill: "Compliance", level: 4 },
      { skill: "Recruiting", level: 3 },
      { skill: "L&D", level: 3 },
      { skill: "Analytics", level: 3 },
    ],
  },
  {
    id: "7",
    name: "Mindy St. Claire",
    email: "mindy@example.com",
    role: "VP of Finance",
    department: "Finance",
    status: "remote",
    hireDate: "2021-09-15",
    salary: 175000,
    manager: "Sarah Chen",
    managerId: "0",
    buId: "eu-dub",
    skills: [
      { skill: "FP&A", level: 5 },
      { skill: "Accounting", level: 4 },
      { skill: "Compliance", level: 4 },
      { skill: "Reporting", level: 5 },
      { skill: "Risk", level: 4 },
      { skill: "Excel", level: 5 },
    ],
  },
  {
    id: "8",
    name: "Derek",
    email: "derek@example.com",
    role: "Accountant",
    department: "Finance",
    status: "active",
    hireDate: "2023-02-14",
    salary: 90000,
    manager: "Mindy St. Claire",
    managerId: "7",
    buId: "jp-tyo",
    skills: [
      { skill: "Accounting", level: 4 },
      { skill: "Excel", level: 4 },
      { skill: "Reporting", level: 4 },
      { skill: "Compliance", level: 4 },
      { skill: "Risk", level: 3 },
      { skill: "FP&A", level: 3 },
    ],
  },
  {
    id: "9",
    name: "Simone Garnett",
    email: "simone@example.com",
    role: "VP of Product",
    department: "Product",
    status: "active",
    hireDate: "2022-04-10",
    salary: 180000,
    manager: "Sarah Chen",
    managerId: "0",
    buId: "us-sea",
    skills: [
      { skill: "Roadmap", level: 5 },
      { skill: "Research", level: 4 },
      { skill: "Analytics", level: 4 },
      { skill: "Agile", level: 5 },
      { skill: "Design", level: 4 },
      { skill: "Communication", level: 4 },
    ],
  },
  {
    id: "10",
    name: "Brent Norwalk",
    email: "brent@example.com",
    role: "Product Manager",
    department: "Product",
    status: "remote",
    hireDate: "2023-07-01",
    salary: 130000,
    manager: "Simone Garnett",
    managerId: "9",
    buId: "in-blr",
    skills: [
      { skill: "Agile", level: 4 },
      { skill: "Roadmap", level: 4 },
      { skill: "Research", level: 4 },
      { skill: "Analytics", level: 4 },
      { skill: "Communication", level: 4 },
      { skill: "Design", level: 3 },
    ],
  },
  // ── New employees added in Task #44 ───────────────────────────────────────
  // Engineering — Backend Engineering team
  {
    id: "11",
    name: "Kai Torres",
    email: "kai.torres@example.com",
    role: "Backend Engineer",
    department: "Engineering",
    status: "active",
    hireDate: "2022-06-01",
    salary: 130000,
    manager: "Eleanor Vance",
    managerId: "1",
    buId: "in-blr",
    skills: [
      { skill: "Backend", level: 4 },
      { skill: "Testing", level: 3 },
      { skill: "Data", level: 3 },
      { skill: "DevOps", level: 2 },
      { skill: "Frontend", level: 2 },
      { skill: "Architecture", level: 2 },
    ],
  },
  // Engineering — Platform & Infrastructure team
  {
    id: "12",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    role: "DevOps Engineer",
    department: "Engineering",
    status: "active",
    hireDate: "2021-08-20",
    salary: 145000,
    manager: "Eleanor Vance",
    managerId: "1",
    buId: "apac-sg",
    skills: [
      { skill: "DevOps", level: 5 },
      { skill: "Architecture", level: 3 },
      { skill: "Backend", level: 3 },
      { skill: "Testing", level: 3 },
      { skill: "Data", level: 2 },
      { skill: "Frontend", level: 1 },
    ],
  },
  // Engineering — Backend Engineering team
  {
    id: "13",
    name: "Luis Ortega",
    email: "luis.ortega@example.com",
    role: "Frontend Engineer",
    department: "Engineering",
    status: "active",
    hireDate: "2023-03-12",
    salary: 120000,
    manager: "Chidi Anagonye",
    managerId: "2",
    buId: "eu-dub",
    skills: [
      { skill: "Frontend", level: 4 },
      { skill: "Testing", level: 3 },
      { skill: "Backend", level: 2 },
      { skill: "Design", level: 3 },
      { skill: "Architecture", level: 2 },
      { skill: "DevOps", level: 1 },
    ],
  },
  // Engineering — Platform & Infrastructure team
  {
    id: "14",
    name: "Anika Patel",
    email: "anika.patel@example.com",
    role: "Platform Engineer",
    department: "Engineering",
    status: "active",
    hireDate: "2024-01-15",
    salary: 125000,
    manager: "Eleanor Vance",
    managerId: "1",
    buId: "us-sea",
    skills: [
      { skill: "DevOps", level: 3 },
      { skill: "Architecture", level: 3 },
      { skill: "Backend", level: 3 },
      { skill: "Data", level: 2 },
      { skill: "Testing", level: 2 },
      { skill: "Frontend", level: 1 },
    ],
  },
  // Marketing — Brand & Campaigns team
  {
    id: "15",
    name: "Clara Reyes",
    email: "clara.reyes@example.com",
    role: "Brand Designer",
    department: "Marketing",
    status: "active",
    hireDate: "2022-09-05",
    salary: 95000,
    manager: "Tahani Al-Jamil",
    managerId: "3",
    buId: "eu-dub",
    skills: [
      { skill: "Design", level: 5 },
      { skill: "Copywriting", level: 3 },
      { skill: "Social Media", level: 3 },
      { skill: "Strategy", level: 2 },
      { skill: "Analytics", level: 2 },
      { skill: "SEO", level: 1 },
    ],
  },
  // Marketing — Digital Marketing team
  {
    id: "16",
    name: "Marcus Webb",
    email: "marcus.webb@example.com",
    role: "SEO Lead",
    department: "Marketing",
    status: "active",
    hireDate: "2022-11-14",
    salary: 105000,
    manager: "Tahani Al-Jamil",
    managerId: "3",
    buId: "us-sea",
    skills: [
      { skill: "SEO", level: 5 },
      { skill: "Analytics", level: 4 },
      { skill: "Copywriting", level: 3 },
      { skill: "Social Media", level: 3 },
      { skill: "Strategy", level: 2 },
      { skill: "Design", level: 1 },
    ],
  },
  // Marketing — Brand & Campaigns team
  {
    id: "17",
    name: "Sophie Blanc",
    email: "sophie.blanc@example.com",
    role: "Content Strategist",
    department: "Marketing",
    status: "remote",
    hireDate: "2023-08-01",
    salary: 98000,
    manager: "Clara Reyes",
    managerId: "15",
    buId: "eu-dub",
    skills: [
      { skill: "Copywriting", level: 5 },
      { skill: "Strategy", level: 3 },
      { skill: "Social Media", level: 4 },
      { skill: "SEO", level: 3 },
      { skill: "Analytics", level: 2 },
      { skill: "Design", level: 2 },
    ],
  },
  // HR — Talent Acquisition team
  {
    id: "18",
    name: "Amara Diallo",
    email: "amara.diallo@example.com",
    role: "Senior Recruiter",
    department: "HR",
    status: "active",
    hireDate: "2022-03-07",
    salary: 92000,
    manager: "Michael Realman",
    managerId: "5",
    buId: "apac-sg",
    skills: [
      { skill: "Recruiting", level: 5 },
      { skill: "Communication", level: 4 },
      { skill: "Analytics", level: 3 },
      { skill: "Compliance", level: 2 },
      { skill: "L&D", level: 2 },
      { skill: "Payroll", level: 1 },
    ],
  },
  // HR — HR Business Partners team
  {
    id: "19",
    name: "Tom Nguyen",
    email: "tom.nguyen@example.com",
    role: "HR Generalist",
    department: "HR",
    status: "active",
    hireDate: "2023-06-19",
    salary: 85000,
    manager: "Michael Realman",
    managerId: "5",
    buId: "us-sea",
    skills: [
      { skill: "Communication", level: 4 },
      { skill: "Compliance", level: 3 },
      { skill: "Recruiting", level: 3 },
      { skill: "L&D", level: 3 },
      { skill: "Payroll", level: 2 },
      { skill: "Analytics", level: 2 },
    ],
  },
  // Finance — FP&A team
  {
    id: "20",
    name: "Leila Mansouri",
    email: "leila.mansouri@example.com",
    role: "Financial Analyst",
    department: "Finance",
    status: "active",
    hireDate: "2022-10-03",
    salary: 110000,
    manager: "Mindy St. Claire",
    managerId: "7",
    buId: "eu-dub",
    skills: [
      { skill: "FP&A", level: 4 },
      { skill: "Reporting", level: 4 },
      { skill: "Excel", level: 4 },
      { skill: "Accounting", level: 3 },
      { skill: "Risk", level: 2 },
      { skill: "Compliance", level: 2 },
    ],
  },
  // Finance — Accounting & Compliance team
  {
    id: "21",
    name: "Ryo Nakamura",
    email: "ryo.nakamura@example.com",
    role: "Compliance Analyst",
    department: "Finance",
    status: "active",
    hireDate: "2023-01-09",
    salary: 95000,
    manager: "Mindy St. Claire",
    managerId: "7",
    buId: "jp-tyo",
    skills: [
      { skill: "Compliance", level: 4 },
      { skill: "Risk", level: 4 },
      { skill: "Accounting", level: 3 },
      { skill: "Reporting", level: 3 },
      { skill: "Excel", level: 3 },
      { skill: "FP&A", level: 2 },
    ],
  },
  // Product — Product Management team
  {
    id: "22",
    name: "Sam Foster",
    email: "sam.foster@example.com",
    role: "UX Designer",
    department: "Product",
    status: "active",
    hireDate: "2022-07-18",
    salary: 115000,
    manager: "Simone Garnett",
    managerId: "9",
    buId: "us-sea",
    skills: [
      { skill: "Design", level: 5 },
      { skill: "Research", level: 4 },
      { skill: "Communication", level: 3 },
      { skill: "Analytics", level: 3 },
      { skill: "Roadmap", level: 2 },
      { skill: "Agile", level: 2 },
    ],
  },
  // Product — Product Strategy team
  {
    id: "23",
    name: "Ines Dubois",
    email: "ines.dubois@example.com",
    role: "Product Analyst",
    department: "Product",
    status: "active",
    hireDate: "2023-04-24",
    salary: 108000,
    manager: "Simone Garnett",
    managerId: "9",
    buId: "eu-dub",
    skills: [
      { skill: "Analytics", level: 4 },
      { skill: "Research", level: 4 },
      { skill: "Roadmap", level: 3 },
      { skill: "Communication", level: 3 },
      { skill: "Agile", level: 3 },
      { skill: "Design", level: 2 },
    ],
  },
  // Product — Product Strategy team
  {
    id: "24",
    name: "Raj Patel",
    email: "raj.patel@example.com",
    role: "UX Researcher",
    department: "Product",
    status: "active",
    hireDate: "2024-02-05",
    salary: 100000,
    manager: "Simone Garnett",
    managerId: "9",
    buId: "in-blr",
    skills: [
      { skill: "Research", level: 4 },
      { skill: "Analytics", level: 3 },
      { skill: "Design", level: 3 },
      { skill: "Communication", level: 3 },
      { skill: "Agile", level: 2 },
      { skill: "Roadmap", level: 2 },
    ],
  },
];

// ============================================================
// DOMAIN: Employee Extended Attributes (from backend schema)
// ============================================================

export type ContractType = "FULL_TIME" | "PART_TIME" | "INTERN" | "CONTRACTOR" | "FIXED_TERM";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type EducationLevel = "BELOW_COLLEGE" | "COLLEGE" | "BACHELOR" | "MASTER" | "DOCTOR";
export type PositionLevel = "JUNIOR" | "MEDIUM" | "CONFIRMED" | "SENIOR_1" | "SENIOR_2" | "EXPERT";

export type EmployeeExtra = {
  employeeCode: string;
  phone: string;
  dateOfBirth: string;
  contractType: ContractType;
  netSalary: number;
  maritalStatus: MaritalStatus;
  educationLevel: EducationLevel;
  educationField: string;
  positionLevel: PositionLevel;
  isKeyPosition: boolean;
  team: string;
};

export const employeeExtras: Record<string, EmployeeExtra> = {
  "0":  { employeeCode: "EMP-001", phone: "+1 555-0101", dateOfBirth: "1979-04-22", contractType: "FULL_TIME",  netSalary: 224000, maritalStatus: "MARRIED",  educationLevel: "MASTER",  educationField: "Business Administration", positionLevel: "EXPERT",   isKeyPosition: true,  team: "Executive Leadership"        },
  "1":  { employeeCode: "EMP-002", phone: "+1 555-0102", dateOfBirth: "1986-09-14", contractType: "FULL_TIME",  netSalary: 130000, maritalStatus: "SINGLE",   educationLevel: "MASTER",  educationField: "Computer Science",         positionLevel: "SENIOR_2", isKeyPosition: true,  team: "Platform & Infrastructure"   },
  "2":  { employeeCode: "EMP-003", phone: "+1 555-0103", dateOfBirth: "1991-02-07", contractType: "FULL_TIME",  netSalary: 109000, maritalStatus: "SINGLE",   educationLevel: "MASTER",  educationField: "Software Engineering",     positionLevel: "SENIOR_1", isKeyPosition: false, team: "Backend Engineering"         },
  "3":  { employeeCode: "EMP-004", phone: "+1 555-0104", dateOfBirth: "1988-12-03", contractType: "FULL_TIME",  netSalary: 116000, maritalStatus: "MARRIED",  educationLevel: "BACHELOR",educationField: "Marketing",               positionLevel: "SENIOR_2", isKeyPosition: true,  team: "Brand & Campaigns"           },
  "4":  { employeeCode: "EMP-005", phone: "+1 555-0105", dateOfBirth: "1994-06-18", contractType: "FULL_TIME",  netSalary: 77000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Communications",          positionLevel: "MEDIUM",   isKeyPosition: false, team: "Digital Marketing"           },
  "5":  { employeeCode: "EMP-006", phone: "+1 555-0106", dateOfBirth: "1983-11-30", contractType: "FULL_TIME",  netSalary: 102000, maritalStatus: "MARRIED",  educationLevel: "BACHELOR",educationField: "Human Resources",         positionLevel: "CONFIRMED",isKeyPosition: false, team: "HR Business Partners"        },
  "6":  { employeeCode: "EMP-007", phone: "+1 555-0107", dateOfBirth: "1990-05-25", contractType: "FULL_TIME",  netSalary: 67000,  maritalStatus: "SINGLE",   educationLevel: "COLLEGE", educationField: "Business Administration", positionLevel: "JUNIOR",   isKeyPosition: false, team: "HR Business Partners"        },
  "7":  { employeeCode: "EMP-008", phone: "+1 555-0108", dateOfBirth: "1982-07-11", contractType: "FULL_TIME",  netSalary: 123000, maritalStatus: "DIVORCED", educationLevel: "MASTER",  educationField: "Finance",                 positionLevel: "SENIOR_2", isKeyPosition: true,  team: "FP&A"                        },
  "8":  { employeeCode: "EMP-009", phone: "+1 555-0109", dateOfBirth: "1996-01-08", contractType: "FULL_TIME",  netSalary: 63000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Accounting",              positionLevel: "JUNIOR",   isKeyPosition: false, team: "Accounting & Compliance"     },
  "9":  { employeeCode: "EMP-010", phone: "+1 555-0110", dateOfBirth: "1985-08-20", contractType: "FULL_TIME",  netSalary: 126000, maritalStatus: "MARRIED",  educationLevel: "MASTER",  educationField: "Product Management",      positionLevel: "SENIOR_2", isKeyPosition: true,  team: "Product Strategy"            },
  "10": { employeeCode: "EMP-011", phone: "+1 555-0111", dateOfBirth: "1993-03-14", contractType: "FULL_TIME",  netSalary: 91000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Computer Science",         positionLevel: "MEDIUM",   isKeyPosition: false, team: "Product Management"          },
  // New employees (Task #44)
  "11": { employeeCode: "EMP-012", phone: "+91 98-0112", dateOfBirth: "1995-08-11", contractType: "FULL_TIME",  netSalary: 91000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Computer Science",         positionLevel: "MEDIUM",   isKeyPosition: false, team: "Backend Engineering"         },
  "12": { employeeCode: "EMP-013", phone: "+65 9-00113", dateOfBirth: "1989-04-02", contractType: "FULL_TIME",  netSalary: 102000, maritalStatus: "MARRIED",  educationLevel: "MASTER",  educationField: "Information Systems",      positionLevel: "SENIOR_1", isKeyPosition: false, team: "Platform & Infrastructure"   },
  "13": { employeeCode: "EMP-014", phone: "+34 6-00114", dateOfBirth: "1997-01-25", contractType: "FULL_TIME",  netSalary: 84000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Computer Engineering",      positionLevel: "JUNIOR",   isKeyPosition: false, team: "Backend Engineering"         },
  "14": { employeeCode: "EMP-015", phone: "+1 555-0115", dateOfBirth: "1996-11-08", contractType: "FULL_TIME",  netSalary: 88000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Computer Science",         positionLevel: "JUNIOR",   isKeyPosition: false, team: "Platform & Infrastructure"   },
  "15": { employeeCode: "EMP-016", phone: "+34 6-00116", dateOfBirth: "1990-07-19", contractType: "FULL_TIME",  netSalary: 67000,  maritalStatus: "MARRIED",  educationLevel: "BACHELOR",educationField: "Graphic Design",           positionLevel: "CONFIRMED",isKeyPosition: false, team: "Brand & Campaigns"           },
  "16": { employeeCode: "EMP-017", phone: "+1 555-0117", dateOfBirth: "1988-12-30", contractType: "FULL_TIME",  netSalary: 74000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Digital Marketing",        positionLevel: "CONFIRMED",isKeyPosition: false, team: "Digital Marketing"           },
  "17": { employeeCode: "EMP-018", phone: "+33 6-00118", dateOfBirth: "1992-05-14", contractType: "FULL_TIME",  netSalary: 69000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Communications",          positionLevel: "MEDIUM",   isKeyPosition: false, team: "Brand & Campaigns"           },
  "18": { employeeCode: "EMP-019", phone: "+65 9-00119", dateOfBirth: "1991-09-03", contractType: "FULL_TIME",  netSalary: 65000,  maritalStatus: "MARRIED",  educationLevel: "BACHELOR",educationField: "Human Resources",         positionLevel: "CONFIRMED",isKeyPosition: false, team: "Talent Acquisition"          },
  "19": { employeeCode: "EMP-020", phone: "+1 555-0120", dateOfBirth: "1995-02-17", contractType: "FULL_TIME",  netSalary: 60000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Business Administration", positionLevel: "JUNIOR",   isKeyPosition: false, team: "Talent Acquisition"          },
  "20": { employeeCode: "EMP-021", phone: "+33 6-00121", dateOfBirth: "1990-06-28", contractType: "FULL_TIME",  netSalary: 77000,  maritalStatus: "MARRIED",  educationLevel: "MASTER",  educationField: "Finance",                 positionLevel: "CONFIRMED",isKeyPosition: false, team: "FP&A"                        },
  "21": { employeeCode: "EMP-022", phone: "+81 9-00122", dateOfBirth: "1994-03-16", contractType: "FULL_TIME",  netSalary: 67000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Accounting",              positionLevel: "JUNIOR",   isKeyPosition: false, team: "Accounting & Compliance"     },
  "22": { employeeCode: "EMP-023", phone: "+1 555-0123", dateOfBirth: "1991-10-22", contractType: "FULL_TIME",  netSalary: 81000,  maritalStatus: "SINGLE",   educationLevel: "BACHELOR",educationField: "Interaction Design",       positionLevel: "CONFIRMED",isKeyPosition: false, team: "Product Management"          },
  "23": { employeeCode: "EMP-024", phone: "+32 4-00124", dateOfBirth: "1994-07-09", contractType: "FULL_TIME",  netSalary: 76000,  maritalStatus: "SINGLE",   educationLevel: "MASTER",  educationField: "Data Science",             positionLevel: "MEDIUM",   isKeyPosition: false, team: "Product Strategy"            },
  "24": { employeeCode: "EMP-025", phone: "+91 98-0125", dateOfBirth: "1996-12-01", contractType: "FULL_TIME",  netSalary: 70000,  maritalStatus: "SINGLE",   educationLevel: "MASTER",  educationField: "Human-Computer Interaction",positionLevel: "JUNIOR",  isKeyPosition: false, team: "Product Strategy"            },
};

// ============================================================
// DOMAIN: Positions, Skills, Skills Gap
// ============================================================

export type SkillCategory = "TECHNICAL" | "LEADERSHIP" | "BEHAVIORAL" | "DOMAIN" | "OTHER";
export type RequirementLevel = "MANDATORY" | "EXPECTED" | "NICE_TO_HAVE";
export type SkillGapStatus = "MET" | "EXCEEDS" | "PARTIAL" | "MISSING";

export type Skill = {
  id: string;
  name: string;
  category: SkillCategory;
};

export type PositionSkill = {
  id: string;
  positionId: string;
  skillId: string;
  skill: Skill;
  proficiency: number;
  requirementLevel: RequirementLevel;
};

export type Position = {
  id: string;
  title: string;
  level: PositionLevel;
  isActive: boolean;
  isKeyPosition: boolean;
  department: string;
  team: string;
};

export type SkillGapItem = {
  skill: Skill;
  requiredProficiency: number;
  requirementLevel: RequirementLevel;
  acquiredProficiency: number | null;
  status: SkillGapStatus;
};

export type SkillsGapResult = {
  employeeId: string;
  positionId: string;
  positionTitle?: string;
  items: SkillGapItem[];
  summary: { met: number; partial: number; exceeds: number };
};

export const skills: Skill[] = [
  // TECHNICAL
  { id: "sk-1",  name: "Backend",      category: "TECHNICAL" },
  { id: "sk-2",  name: "Frontend",     category: "TECHNICAL" },
  { id: "sk-3",  name: "DevOps",       category: "TECHNICAL" },
  { id: "sk-4",  name: "Architecture", category: "TECHNICAL" },
  { id: "sk-5",  name: "Testing",      category: "TECHNICAL" },
  { id: "sk-6",  name: "Data",         category: "TECHNICAL" },
  { id: "sk-7",  name: "Excel",        category: "TECHNICAL" },
  // LEADERSHIP
  { id: "sk-8",  name: "Leadership",   category: "LEADERSHIP" },
  { id: "sk-9",  name: "Strategy",     category: "LEADERSHIP" },
  { id: "sk-10", name: "Roadmap",      category: "LEADERSHIP" },
  { id: "sk-11", name: "Agile",        category: "LEADERSHIP" },
  // BEHAVIORAL
  { id: "sk-12", name: "Communication",category: "BEHAVIORAL" },
  { id: "sk-13", name: "Recruiting",   category: "BEHAVIORAL" },
  { id: "sk-14", name: "L&D",          category: "BEHAVIORAL" },
  { id: "sk-15", name: "Compliance",   category: "BEHAVIORAL" },
  { id: "sk-16", name: "Payroll",      category: "BEHAVIORAL" },
  // DOMAIN
  { id: "sk-17", name: "FP&A",         category: "DOMAIN" },
  { id: "sk-18", name: "Accounting",   category: "DOMAIN" },
  { id: "sk-19", name: "Reporting",    category: "DOMAIN" },
  { id: "sk-20", name: "Risk",         category: "DOMAIN" },
  { id: "sk-21", name: "Analytics",    category: "DOMAIN" },
  { id: "sk-22", name: "SEO",          category: "DOMAIN" },
  { id: "sk-23", name: "Social Media", category: "DOMAIN" },
  { id: "sk-24", name: "Copywriting",  category: "DOMAIN" },
  { id: "sk-25", name: "Design",       category: "DOMAIN" },
  { id: "sk-26", name: "Research",     category: "DOMAIN" },
];

export const positions: Position[] = [
  { id: "pos-1",  title: "CEO",                      level: "EXPERT",    isActive: true, isKeyPosition: true,  department: "Executive",    team: "Executive Leadership"      },
  { id: "pos-2",  title: "VP of Engineering",         level: "SENIOR_2",  isActive: true, isKeyPosition: true,  department: "Engineering",  team: "Backend Engineering"       },
  { id: "pos-3",  title: "Senior Backend Engineer",   level: "SENIOR_1",  isActive: true, isKeyPosition: false, department: "Engineering",  team: "Backend Engineering"       },
  { id: "pos-4",  title: "Director of Marketing",     level: "SENIOR_2",  isActive: true, isKeyPosition: true,  department: "Marketing",    team: "Brand & Campaigns"         },
  { id: "pos-5",  title: "Marketing Manager",         level: "MEDIUM",    isActive: true, isKeyPosition: false, department: "Marketing",    team: "Digital Marketing"         },
  { id: "pos-6",  title: "Head of HR",                level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "HR",           team: "HR Business Partners"      },
  { id: "pos-7",  title: "People Operations Manager", level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "HR",           team: "HR Business Partners"      },
  { id: "pos-8",  title: "VP of Finance",             level: "SENIOR_2",  isActive: true, isKeyPosition: true,  department: "Finance",      team: "FP&A"                      },
  { id: "pos-9",  title: "Accountant",                level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "Finance",      team: "Accounting & Compliance"   },
  { id: "pos-10", title: "VP of Product",             level: "SENIOR_2",  isActive: true, isKeyPosition: true,  department: "Product",      team: "Product Strategy"          },
  { id: "pos-11", title: "Product Manager",           level: "MEDIUM",    isActive: true, isKeyPosition: false, department: "Product",      team: "Product Strategy"          },
  { id: "pos-12", title: "Backend Engineer",          level: "MEDIUM",    isActive: true, isKeyPosition: false, department: "Engineering",  team: "Backend Engineering"       },
  { id: "pos-13", title: "DevOps Engineer",           level: "SENIOR_1",  isActive: true, isKeyPosition: false, department: "Engineering",  team: "Platform & Infrastructure" },
  { id: "pos-14", title: "Frontend Engineer",         level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "Engineering",  team: "Frontend Engineering"      },
  { id: "pos-15", title: "Platform Engineer",         level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "Engineering",  team: "Platform & Infrastructure" },
  { id: "pos-16", title: "Brand Designer",            level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "Marketing",    team: "Brand & Campaigns"         },
  { id: "pos-17", title: "SEO Lead",                  level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "Marketing",    team: "Digital Marketing"         },
  { id: "pos-18", title: "Content Strategist",        level: "MEDIUM",    isActive: true, isKeyPosition: false, department: "Marketing",    team: "Digital Marketing"         },
  { id: "pos-19", title: "Senior Recruiter",          level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "HR",           team: "Talent Acquisition"        },
  { id: "pos-20", title: "HR Generalist",             level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "HR",           team: "Talent Acquisition"        },
  { id: "pos-21", title: "Financial Analyst",         level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "Finance",      team: "FP&A"                      },
  { id: "pos-22", title: "Compliance Analyst",        level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "Finance",      team: "Accounting & Compliance"   },
  { id: "pos-23", title: "UX Designer",               level: "CONFIRMED", isActive: true, isKeyPosition: false, department: "Product",      team: "UX"                        },
  { id: "pos-24", title: "Product Analyst",           level: "MEDIUM",    isActive: true, isKeyPosition: false, department: "Product",      team: "Analytics"                 },
  { id: "pos-25", title: "UX Researcher",             level: "JUNIOR",    isActive: true, isKeyPosition: false, department: "Product",      team: "UX"                        },
];

// Maps employee id → position id
export const employeePositionIds: Record<string, string> = {
  "0":  "pos-1",  "1":  "pos-2",  "2":  "pos-3",  "3":  "pos-4",
  "4":  "pos-5",  "5":  "pos-6",  "6":  "pos-7",  "7":  "pos-8",
  "8":  "pos-9",  "9":  "pos-10", "10": "pos-11", "11": "pos-12",
  "12": "pos-13", "13": "pos-14", "14": "pos-15", "15": "pos-16",
  "16": "pos-17", "17": "pos-18", "18": "pos-19", "19": "pos-20",
  "20": "pos-21", "21": "pos-22", "22": "pos-23", "23": "pos-24",
  "24": "pos-25",
};

// Helper to find a skill by name
function sk(name: string): Skill {
  const found = skills.find((s) => s.name === name);
  if (!found) throw new Error(`Skill not found: ${name}`);
  return found;
}

// Default position skill profiles — keyed by positionId
export const defaultPositionSkills: Record<string, Omit<PositionSkill, "id" | "positionId">[]> = {
  "pos-1": [
    { skillId: "sk-9",  skill: sk("Strategy"),      proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-8",  skill: sk("Leadership"),     proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-17", skill: sk("FP&A"),           proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "EXPECTED"     },
  ],
  "pos-2": [
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-8",  skill: sk("Leadership"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  skill: sk("Data"),           proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-3": [
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  skill: sk("Data"),           proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  skill: sk("Frontend"),       proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-4": [
    { skillId: "sk-9",  skill: sk("Strategy"),       proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", skill: sk("Copywriting"),    proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", skill: sk("Social Media"),   proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", skill: sk("SEO"),            proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-5": [
    { skillId: "sk-23", skill: sk("Social Media"),   proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", skill: sk("Copywriting"),    proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", skill: sk("SEO"),            proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-9",  skill: sk("Strategy"),       proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-6": [
    { skillId: "sk-13", skill: sk("Recruiting"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", skill: sk("L&D"),            proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-16", skill: sk("Payroll"),        proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-7": [
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-16", skill: sk("Payroll"),        proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-13", skill: sk("Recruiting"),     proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", skill: sk("L&D"),            proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-8": [
    { skillId: "sk-17", skill: sk("FP&A"),           proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", skill: sk("Accounting"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", skill: sk("Reporting"),      proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-20", skill: sk("Risk"),           proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-7",  skill: sk("Excel"),          proficiency: 5, requirementLevel: "EXPECTED"     },
  ],
  "pos-9": [
    { skillId: "sk-18", skill: sk("Accounting"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-7",  skill: sk("Excel"),          proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", skill: sk("Reporting"),      proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-20", skill: sk("Risk"),           proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-17", skill: sk("FP&A"),           proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-10": [
    { skillId: "sk-10", skill: sk("Roadmap"),        proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", skill: sk("Research"),       proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-11", skill: sk("Agile"),          proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 4, requirementLevel: "EXPECTED"     },
  ],
  "pos-11": [
    { skillId: "sk-11", skill: sk("Agile"),          proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-10", skill: sk("Roadmap"),        proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", skill: sk("Research"),       proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-12": [
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-6",  skill: sk("Data"),           proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  skill: sk("Frontend"),       proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-13": [
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  skill: sk("Data"),           proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-2",  skill: sk("Frontend"),       proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-14": [
    { skillId: "sk-2",  skill: sk("Frontend"),       proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-15": [
    { skillId: "sk-3",  skill: sk("DevOps"),         proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  skill: sk("Architecture"),   proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  skill: sk("Backend"),        proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  skill: sk("Data"),           proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-5",  skill: sk("Testing"),        proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  skill: sk("Frontend"),       proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-16": [
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", skill: sk("Copywriting"),    proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", skill: sk("Social Media"),   proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-9",  skill: sk("Strategy"),       proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-22", skill: sk("SEO"),            proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-17": [
    { skillId: "sk-22", skill: sk("SEO"),            proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", skill: sk("Copywriting"),    proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-23", skill: sk("Social Media"),   proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-9",  skill: sk("Strategy"),       proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-18": [
    { skillId: "sk-24", skill: sk("Copywriting"),    proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-9",  skill: sk("Strategy"),       proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", skill: sk("Social Media"),   proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", skill: sk("SEO"),            proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-19": [
    { skillId: "sk-13", skill: sk("Recruiting"),     proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", skill: sk("L&D"),            proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-16", skill: sk("Payroll"),        proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-20": [
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-13", skill: sk("Recruiting"),     proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", skill: sk("L&D"),            proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-16", skill: sk("Payroll"),        proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-21": [
    { skillId: "sk-17", skill: sk("FP&A"),           proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", skill: sk("Reporting"),      proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-7",  skill: sk("Excel"),          proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", skill: sk("Accounting"),     proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-20", skill: sk("Risk"),           proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-22": [
    { skillId: "sk-15", skill: sk("Compliance"),     proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-20", skill: sk("Risk"),           proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", skill: sk("Accounting"),     proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", skill: sk("Reporting"),      proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-7",  skill: sk("Excel"),          proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-17", skill: sk("FP&A"),           proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-23": [
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", skill: sk("Research"),       proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-10", skill: sk("Roadmap"),        proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-11", skill: sk("Agile"),          proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-24": [
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", skill: sk("Research"),       proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-10", skill: sk("Roadmap"),        proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-11", skill: sk("Agile"),          proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-25": [
    { skillId: "sk-26", skill: sk("Research"),       proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", skill: sk("Analytics"),      proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", skill: sk("Design"),         proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", skill: sk("Communication"),  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-11", skill: sk("Agile"),          proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-10", skill: sk("Roadmap"),        proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
};

export type SalaryEntry = {
  effectiveDate: string;
  previousGross: number;
  newGross: number;
  raisePercentage: number;
  reason: "PROMOTION" | "ANNUAL_REVIEW" | "NEW_FUNCTION" | "OTHER";
  comment: string;
};

export const salaryHistory: Record<string, SalaryEntry[]> = {
  "0": [
    { effectiveDate: "2022-01-01", previousGross: 260000, newGross: 280000, raisePercentage: 7.7, reason: "ANNUAL_REVIEW", comment: "Strong fiscal year performance"     },
    { effectiveDate: "2023-01-01", previousGross: 280000, newGross: 300000, raisePercentage: 7.1, reason: "ANNUAL_REVIEW", comment: "Exceptional leadership and growth"  },
    { effectiveDate: "2024-01-01", previousGross: 300000, newGross: 320000, raisePercentage: 6.7, reason: "ANNUAL_REVIEW", comment: "Record company performance"          },
  ],
  "1": [
    { effectiveDate: "2022-01-01", previousGross: 150000, newGross: 160000, raisePercentage: 6.7, reason: "NEW_FUNCTION",  comment: "Promotion to VP of Engineering"      },
    { effectiveDate: "2023-01-01", previousGross: 160000, newGross: 175000, raisePercentage: 9.4, reason: "ANNUAL_REVIEW", comment: "Delivered platform modernization"    },
    { effectiveDate: "2024-01-01", previousGross: 175000, newGross: 185000, raisePercentage: 5.7, reason: "ANNUAL_REVIEW", comment: "Team growth and reliability"         },
  ],
  "2": [
    { effectiveDate: "2022-07-01", previousGross: 130000, newGross: 140000, raisePercentage: 7.7, reason: "ANNUAL_REVIEW", comment: "Strong technical contributions"      },
    { effectiveDate: "2023-01-01", previousGross: 140000, newGross: 150000, raisePercentage: 7.1, reason: "PROMOTION",     comment: "Promoted to Senior Backend Engineer" },
    { effectiveDate: "2024-01-01", previousGross: 150000, newGross: 155000, raisePercentage: 3.3, reason: "ANNUAL_REVIEW", comment: "Consistent delivery"                 },
  ],
  "3": [
    { effectiveDate: "2022-01-01", previousGross: 140000, newGross: 150000, raisePercentage: 7.1, reason: "ANNUAL_REVIEW", comment: "Exceeded campaign targets"           },
    { effectiveDate: "2023-01-01", previousGross: 150000, newGross: 160000, raisePercentage: 6.7, reason: "PROMOTION",     comment: "Promoted to Director of Marketing"  },
    { effectiveDate: "2024-01-01", previousGross: 160000, newGross: 165000, raisePercentage: 3.1, reason: "ANNUAL_REVIEW", comment: "Market expansion results"           },
  ],
  "4": [
    { effectiveDate: "2023-11-01", previousGross: 100000, newGross: 110000, raisePercentage: 10.0, reason: "ANNUAL_REVIEW", comment: "Exceeded social media KPIs"        },
  ],
  "5": [
    { effectiveDate: "2021-01-01", previousGross: 120000, newGross: 130000, raisePercentage: 8.3, reason: "ANNUAL_REVIEW", comment: "Built HR function from ground up"   },
    { effectiveDate: "2022-01-01", previousGross: 130000, newGross: 138000, raisePercentage: 6.2, reason: "ANNUAL_REVIEW", comment: "Compliance framework delivery"       },
    { effectiveDate: "2023-01-01", previousGross: 138000, newGross: 145000, raisePercentage: 5.1, reason: "ANNUAL_REVIEW", comment: "Talent acquisition success"          },
  ],
  "6": [
    { effectiveDate: "2021-01-01", previousGross: 80000,  newGross: 85000,  raisePercentage: 6.3, reason: "ANNUAL_REVIEW", comment: "Office operations improvement"      },
    { effectiveDate: "2022-01-01", previousGross: 85000,  newGross: 90000,  raisePercentage: 5.9, reason: "ANNUAL_REVIEW", comment: "Expanded responsibilities"           },
    { effectiveDate: "2023-01-01", previousGross: 90000,  newGross: 95000,  raisePercentage: 5.6, reason: "ANNUAL_REVIEW", comment: "Consistent performance"              },
  ],
  "7": [
    { effectiveDate: "2022-01-01", previousGross: 155000, newGross: 165000, raisePercentage: 6.5, reason: "ANNUAL_REVIEW", comment: "Cost reduction initiatives"         },
    { effectiveDate: "2023-01-01", previousGross: 165000, newGross: 175000, raisePercentage: 6.1, reason: "PROMOTION",     comment: "Expanded to VP role"                },
  ],
  "8": [
    { effectiveDate: "2024-01-01", previousGross: 83000,  newGross: 90000,  raisePercentage: 8.4, reason: "ANNUAL_REVIEW", comment: "First annual review — strong progress" },
  ],
  "9": [
    { effectiveDate: "2022-10-01", previousGross: 150000, newGross: 165000, raisePercentage: 10.0, reason: "NEW_FUNCTION",  comment: "Promotion to VP of Product"        },
    { effectiveDate: "2023-07-01", previousGross: 165000, newGross: 175000, raisePercentage: 6.1,  reason: "ANNUAL_REVIEW", comment: "Launched 3 major product lines"    },
    { effectiveDate: "2024-01-01", previousGross: 175000, newGross: 180000, raisePercentage: 2.9,  reason: "ANNUAL_REVIEW", comment: "Strong roadmap delivery"            },
  ],
  "10": [
    { effectiveDate: "2024-01-01", previousGross: 120000, newGross: 130000, raisePercentage: 8.3, reason: "ANNUAL_REVIEW", comment: "First annual review — exceeded expectations" },
  ],
  // New employees (Task #44)
  "11": [
    { effectiveDate: "2023-01-01", previousGross: 120000, newGross: 130000, raisePercentage: 8.3, reason: "ANNUAL_REVIEW", comment: "Strong backend delivery in first year" },
  ],
  "12": [
    { effectiveDate: "2022-01-01", previousGross: 130000, newGross: 138000, raisePercentage: 6.2, reason: "ANNUAL_REVIEW", comment: "CI/CD pipeline improvements" },
    { effectiveDate: "2023-01-01", previousGross: 138000, newGross: 145000, raisePercentage: 5.1, reason: "PROMOTION",     comment: "Promoted to senior DevOps role" },
  ],
  "13": [
    { effectiveDate: "2024-01-01", previousGross: 113000, newGross: 120000, raisePercentage: 6.2, reason: "ANNUAL_REVIEW", comment: "Solid first-year frontend delivery" },
  ],
  "14": [
    { effectiveDate: "2025-01-01", previousGross: 118000, newGross: 125000, raisePercentage: 5.9, reason: "ANNUAL_REVIEW", comment: "Infrastructure reliability improvements" },
  ],
  "15": [
    { effectiveDate: "2023-01-01", previousGross: 88000,  newGross: 95000,  raisePercentage: 8.0, reason: "ANNUAL_REVIEW", comment: "Brand refresh campaign success" },
  ],
  "16": [
    { effectiveDate: "2023-01-01", previousGross: 98000,  newGross: 105000, raisePercentage: 7.1, reason: "ANNUAL_REVIEW", comment: "Organic traffic grew 40% YoY" },
  ],
  "17": [
    { effectiveDate: "2024-01-01", previousGross: 92000,  newGross: 98000,  raisePercentage: 6.5, reason: "ANNUAL_REVIEW", comment: "Content strategy drove engagement lift" },
  ],
  "18": [
    { effectiveDate: "2023-01-01", previousGross: 85000,  newGross: 92000,  raisePercentage: 8.2, reason: "PROMOTION",     comment: "Promoted to Senior Recruiter" },
  ],
  "19": [
    { effectiveDate: "2024-01-01", previousGross: 80000,  newGross: 85000,  raisePercentage: 6.3, reason: "ANNUAL_REVIEW", comment: "First annual review — strong onboarding support" },
  ],
  "20": [
    { effectiveDate: "2023-01-01", previousGross: 103000, newGross: 110000, raisePercentage: 6.8, reason: "ANNUAL_REVIEW", comment: "Budget variance analysis praised" },
  ],
  "21": [
    { effectiveDate: "2024-01-01", previousGross: 89000,  newGross: 95000,  raisePercentage: 6.7, reason: "ANNUAL_REVIEW", comment: "Compliance audit passed with zero findings" },
  ],
  "22": [
    { effectiveDate: "2023-01-01", previousGross: 108000, newGross: 115000, raisePercentage: 6.5, reason: "ANNUAL_REVIEW", comment: "Design system rollout" },
  ],
  "23": [
    { effectiveDate: "2024-01-01", previousGross: 101000, newGross: 108000, raisePercentage: 6.9, reason: "ANNUAL_REVIEW", comment: "Strong data-driven product insights" },
  ],
  "24": [
    { effectiveDate: "2025-01-01", previousGross: 94000,  newGross: 100000, raisePercentage: 6.4, reason: "ANNUAL_REVIEW", comment: "First annual review — excellent user research" },
  ],
};

export type SkillSnapshot = { date: string; label: string; skills: Record<string, number> };

export const skillHistory: Record<string, SkillSnapshot[]> = {
  "0": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Strategy: 3, Leadership: 3, Communication: 4, Finance: 2, Operations: 2 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Strategy: 4, Leadership: 4, Communication: 4, Finance: 3, Operations: 3 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Strategy: 4, Leadership: 4, Communication: 5, Finance: 3, Operations: 4 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Strategy: 5, Leadership: 5, Communication: 5, Finance: 4, Operations: 4 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Strategy: 5, Leadership: 5, Communication: 5, Finance: 4, Operations: 4 } },
  ],
  "1": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Architecture: 3, Backend: 3, DevOps: 2, Leadership: 2, Testing: 3, Data: 2 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Architecture: 3, Backend: 4, DevOps: 3, Leadership: 3, Testing: 3, Data: 3 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Architecture: 4, Backend: 4, DevOps: 3, Leadership: 3, Testing: 4, Data: 3 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Architecture: 5, Backend: 4, DevOps: 4, Leadership: 4, Testing: 4, Data: 3 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Architecture: 5, Backend: 4, DevOps: 4, Leadership: 4, Testing: 4, Data: 4 } },
  ],
  "2": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Backend: 3, Architecture: 2, Testing: 2, DevOps: 1, Data: 2, Frontend: 1 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Backend: 4, Architecture: 3, Testing: 3, DevOps: 2, Data: 3, Frontend: 1 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Backend: 4, Architecture: 3, Testing: 3, DevOps: 2, Data: 3, Frontend: 2 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Backend: 5, Architecture: 4, Testing: 4, DevOps: 3, Data: 4, Frontend: 2 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Backend: 5, Architecture: 4, Testing: 4, DevOps: 3, Data: 4, Frontend: 2 } },
  ],
  "3": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Strategy: 3, Copywriting: 3, Analytics: 2, "Social Media": 3, Design: 2, SEO: 2 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Strategy: 4, Copywriting: 3, Analytics: 3, "Social Media": 3, Design: 2, SEO: 3 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Strategy: 4, Copywriting: 4, Analytics: 3, "Social Media": 4, Design: 3, SEO: 3 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Strategy: 5, Copywriting: 4, Analytics: 4, "Social Media": 4, Design: 3, SEO: 4 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Strategy: 5, Copywriting: 4, Analytics: 4, "Social Media": 4, Design: 3, SEO: 4 } },
  ],
  "4": [
    { date: "2024-01-01", label: "Q1 '24", skills: { "Social Media": 3, Copywriting: 2, Analytics: 2, SEO: 2, Design: 2, Strategy: 2 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { "Social Media": 4, Copywriting: 3, Analytics: 2, SEO: 2, Design: 3, Strategy: 2 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { "Social Media": 4, Copywriting: 3, Analytics: 3, SEO: 3, Design: 3, Strategy: 3 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { "Social Media": 5, Copywriting: 4, Analytics: 3, SEO: 3, Design: 4, Strategy: 3 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { "Social Media": 5, Copywriting: 4, Analytics: 3, SEO: 3, Design: 4, Strategy: 3 } },
  ],
  "5": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Recruiting: 2, Compliance: 2, Communication: 3, Analytics: 2, "L&D": 2, Payroll: 2 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Recruiting: 3, Compliance: 3, Communication: 4, Analytics: 3, "L&D": 3, Payroll: 3 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Recruiting: 3, Compliance: 3, Communication: 4, Analytics: 3, "L&D": 3, Payroll: 4 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Recruiting: 4, Compliance: 4, Communication: 5, Analytics: 4, "L&D": 4, Payroll: 4 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Recruiting: 4, Compliance: 4, Communication: 5, Analytics: 4, "L&D": 4, Payroll: 4 } },
  ],
  "6": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Communication: 2, Payroll: 2, Compliance: 2, Recruiting: 1, "L&D": 1, Analytics: 1 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Communication: 3, Payroll: 2, Compliance: 3, Recruiting: 2, "L&D": 2, Analytics: 2 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Communication: 4, Payroll: 3, Compliance: 3, Recruiting: 2, "L&D": 2, Analytics: 2 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Communication: 4, Payroll: 3, Compliance: 4, Recruiting: 3, "L&D": 3, Analytics: 3 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Communication: 4, Payroll: 3, Compliance: 4, Recruiting: 3, "L&D": 3, Analytics: 3 } },
  ],
  "7": [
    { date: "2024-01-01", label: "Q1 '24", skills: { "FP&A": 3, Accounting: 3, Compliance: 3, Reporting: 3, Risk: 2, Excel: 4 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { "FP&A": 4, Accounting: 4, Compliance: 3, Reporting: 4, Risk: 3, Excel: 4 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { "FP&A": 4, Accounting: 4, Compliance: 4, Reporting: 4, Risk: 4, Excel: 5 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { "FP&A": 5, Accounting: 4, Compliance: 4, Reporting: 5, Risk: 4, Excel: 5 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { "FP&A": 5, Accounting: 4, Compliance: 4, Reporting: 5, Risk: 4, Excel: 5 } },
  ],
  "8": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Accounting: 2, Excel: 2, Reporting: 2, Compliance: 2, Risk: 1, "FP&A": 1 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Accounting: 3, Excel: 3, Reporting: 3, Compliance: 3, Risk: 2, "FP&A": 2 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Accounting: 3, Excel: 4, Reporting: 3, Compliance: 3, Risk: 2, "FP&A": 2 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Accounting: 4, Excel: 4, Reporting: 4, Compliance: 4, Risk: 3, "FP&A": 3 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Accounting: 4, Excel: 4, Reporting: 4, Compliance: 4, Risk: 3, "FP&A": 3 } },
  ],
  "9": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Roadmap: 3, Research: 2, Analytics: 2, Agile: 3, Design: 2, Communication: 3 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Roadmap: 4, Research: 3, Analytics: 3, Agile: 4, Design: 3, Communication: 3 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Roadmap: 4, Research: 4, Analytics: 4, Agile: 4, Design: 3, Communication: 4 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Roadmap: 5, Research: 4, Analytics: 4, Agile: 5, Design: 4, Communication: 4 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Roadmap: 5, Research: 4, Analytics: 4, Agile: 5, Design: 4, Communication: 4 } },
  ],
  "10": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Agile: 2, Roadmap: 2, Research: 2, Analytics: 2, Communication: 2, Design: 1 } },
    { date: "2024-04-01", label: "Q2 '24", skills: { Agile: 3, Roadmap: 3, Research: 3, Analytics: 3, Communication: 3, Design: 2 } },
    { date: "2024-07-01", label: "Q3 '24", skills: { Agile: 3, Roadmap: 3, Research: 3, Analytics: 3, Communication: 4, Design: 2 } },
    { date: "2024-10-01", label: "Q4 '24", skills: { Agile: 4, Roadmap: 4, Research: 4, Analytics: 4, Communication: 4, Design: 3 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Agile: 4, Roadmap: 4, Research: 4, Analytics: 4, Communication: 4, Design: 3 } },
  ],
  // New employees (Task #44) — two snapshots each
  "11": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Backend: 3, Testing: 2, Data: 2, DevOps: 1, Frontend: 1, Architecture: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Backend: 4, Testing: 3, Data: 3, DevOps: 2, Frontend: 2, Architecture: 2 } },
  ],
  "12": [
    { date: "2024-01-01", label: "Q1 '24", skills: { DevOps: 4, Architecture: 2, Backend: 2, Testing: 2, Data: 1, Frontend: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { DevOps: 5, Architecture: 3, Backend: 3, Testing: 3, Data: 2, Frontend: 1 } },
  ],
  "13": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Frontend: 3, Testing: 2, Backend: 1, Design: 2, Architecture: 1, DevOps: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Frontend: 4, Testing: 3, Backend: 2, Design: 3, Architecture: 2, DevOps: 1 } },
  ],
  "14": [
    { date: "2024-07-01", label: "Q3 '24", skills: { DevOps: 2, Architecture: 2, Backend: 2, Data: 1, Testing: 1, Frontend: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { DevOps: 3, Architecture: 3, Backend: 3, Data: 2, Testing: 2, Frontend: 1 } },
  ],
  "15": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Design: 4, Copywriting: 2, "Social Media": 2, Strategy: 1, Analytics: 1, SEO: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Design: 5, Copywriting: 3, "Social Media": 3, Strategy: 2, Analytics: 2, SEO: 1 } },
  ],
  "16": [
    { date: "2024-01-01", label: "Q1 '24", skills: { SEO: 4, Analytics: 3, Copywriting: 2, "Social Media": 2, Strategy: 2, Design: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { SEO: 5, Analytics: 4, Copywriting: 3, "Social Media": 3, Strategy: 2, Design: 1 } },
  ],
  "17": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Copywriting: 4, Strategy: 2, "Social Media": 3, SEO: 2, Analytics: 1, Design: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Copywriting: 5, Strategy: 3, "Social Media": 4, SEO: 3, Analytics: 2, Design: 2 } },
  ],
  "18": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Recruiting: 4, Communication: 3, Analytics: 2, Compliance: 1, "L&D": 1, Payroll: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Recruiting: 5, Communication: 4, Analytics: 3, Compliance: 2, "L&D": 2, Payroll: 1 } },
  ],
  "19": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Communication: 3, Compliance: 2, Recruiting: 2, "L&D": 2, Payroll: 1, Analytics: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Communication: 4, Compliance: 3, Recruiting: 3, "L&D": 3, Payroll: 2, Analytics: 2 } },
  ],
  "20": [
    { date: "2024-01-01", label: "Q1 '24", skills: { "FP&A": 3, Reporting: 3, Excel: 3, Accounting: 2, Risk: 1, Compliance: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { "FP&A": 4, Reporting: 4, Excel: 4, Accounting: 3, Risk: 2, Compliance: 2 } },
  ],
  "21": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Compliance: 3, Risk: 3, Accounting: 2, Reporting: 2, Excel: 2, "FP&A": 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Compliance: 4, Risk: 4, Accounting: 3, Reporting: 3, Excel: 3, "FP&A": 2 } },
  ],
  "22": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Design: 4, Research: 3, Communication: 2, Analytics: 2, Roadmap: 1, Agile: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Design: 5, Research: 4, Communication: 3, Analytics: 3, Roadmap: 2, Agile: 2 } },
  ],
  "23": [
    { date: "2024-01-01", label: "Q1 '24", skills: { Analytics: 3, Research: 3, Roadmap: 2, Communication: 2, Agile: 2, Design: 1 } },
    { date: "2025-01-01", label: "Q1 '25", skills: { Analytics: 4, Research: 4, Roadmap: 3, Communication: 3, Agile: 3, Design: 2 } },
  ],
  "24": [
    { date: "2025-01-01", label: "Q1 '25", skills: { Research: 3, Analytics: 2, Design: 2, Communication: 2, Agile: 1, Roadmap: 1 } },
  ],
};

export const departmentSkills: Record<string, string[]> = {
  Engineering: ["Frontend", "Backend", "DevOps", "Testing", "Architecture", "Data"],
  Marketing: ["Copywriting", "SEO", "Analytics", "Design", "Social Media", "Strategy"],
  HR: ["Recruiting", "Compliance", "L&D", "Analytics", "Communication", "Payroll"],
  Finance: ["Accounting", "FP&A", "Risk", "Compliance", "Excel", "Reporting"],
  Product: ["Roadmap", "Research", "Analytics", "Agile", "Design", "Communication"],
};

export const leaveRequests = [
  {
    id: "1",
    employeeId: "4",
    employeeName: "Jason Mendoza",
    type: "Personal",
    startDate: "2024-05-10",
    endDate: "2024-05-15",
    status: "Approved",
    daysCount: 4,
  },
  {
    id: "2",
    employeeId: "2",
    employeeName: "Chidi Anagonye",
    type: "Sick",
    startDate: "2024-05-12",
    endDate: "2024-05-13",
    status: "Pending",
    daysCount: 2,
  },
  {
    id: "3",
    employeeId: "6",
    employeeName: "Janet",
    type: "Annual",
    startDate: "2024-06-01",
    endDate: "2024-06-14",
    status: "Approved",
    daysCount: 10,
  },
  {
    id: "4",
    employeeId: "8",
    employeeName: "Derek",
    type: "Annual",
    startDate: "2024-05-20",
    endDate: "2024-05-25",
    status: "Rejected",
    daysCount: 5,
  },
  {
    id: "5",
    employeeId: "5",
    employeeName: "Michael Realman",
    type: "Annual",
    startDate: "2024-07-01",
    endDate: "2024-07-05",
    status: "Pending",
    daysCount: 5,
  },
  {
    id: "6",
    employeeId: "5",
    employeeName: "Michael Realman",
    type: "Sick",
    startDate: "2024-04-10",
    endDate: "2024-04-11",
    status: "Approved",
    daysCount: 2,
  },
];

export const myLeaveRequests = leaveRequests.filter(
  (r) => r.employeeId === currentUser.id
);
export const myPendingLeaves = myLeaveRequests.filter(
  (r) => r.status === "Pending"
).length;
export const myApprovedLeaves = myLeaveRequests.filter(
  (r) => r.status === "Approved"
).length;

export const departments = [
  { id: "d1", name: "Engineering", headcount: 45, budget: 6500000 },
  { id: "d2", name: "Marketing", headcount: 18, budget: 2100000 },
  { id: "d3", name: "HR", headcount: 5, budget: 750000 },
  { id: "d4", name: "Finance", headcount: 8, budget: 1200000 },
  { id: "d5", name: "Sales", headcount: 32, budget: 4500000 },
  { id: "d6", name: "Design", headcount: 12, budget: 1800000 },
  { id: "d7", name: "Product", headcount: 7, budget: 1100000 },
];

export const metrics = {
  totalHeadcount: 127,
  activeToday: 98,
  onLeave: 8,
  openPositions: 12,
  avgTenure: "2.4 years",
  npsScore: 74,
  pendingApprovals: leaveRequests.filter((r) => r.status === "Pending").length,
};

// ============================================================
// DOMAIN: Dashboard Time Series & BU mapping
// ============================================================

// Business Units = legal entities / regional subsidiaries of a global cloud
// company (modeled after AWS's geographic structure).
//   us-sea   → Seattle HQ (Amazon Web Services, Inc. — global headquarters)
//   eu-dub   → Dublin (Amazon Web Services EMEA SARL — EMEA HQ)
//   apac-sg  → Singapore (AWS Asia Pacific — APAC HQ)
//   in-blr   → Bengaluru (AWS India — engineering & support hub)
//   jp-tyo   → Tokyo (AWS Japan G.K.)
//   latam-sp → São Paulo (AWS Brasil — LATAM hub)
export const buLabels: Record<string, string> = {
  "us-sea": "Seattle HQ",
  "eu-dub": "Dublin (EMEA HQ)",
  "apac-sg": "Singapore (APAC HQ)",
  "in-blr": "Bengaluru",
  "jp-tyo": "Tokyo",
  "latam-sp": "São Paulo",
};

export const buMap: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const e of employees) {
    if (!m[e.buId]) m[e.buId] = [];
    m[e.buId].push(e.id);
  }
  return m;
})();

// Last 12 months window: Jun 2025 → May 2026
export const monthlyWindow = [
  { key: "2025-06", label: "Jun" },
  { key: "2025-07", label: "Jul" },
  { key: "2025-08", label: "Aug" },
  { key: "2025-09", label: "Sep" },
  { key: "2025-10", label: "Oct" },
  { key: "2025-11", label: "Nov" },
  { key: "2025-12", label: "Dec" },
  { key: "2026-01", label: "Jan" },
  { key: "2026-02", label: "Feb" },
  { key: "2026-03", label: "Mar" },
  { key: "2026-04", label: "Apr" },
  { key: "2026-05", label: "May" },
];

// Monthly new hires per department (last 12 months)
export const monthlyNewHires: Array<{ month: string; Engineering: number; Marketing: number; HR: number; Finance: number; Product: number }> = [
  { month: "Jun", Engineering: 2, Marketing: 1, HR: 0, Finance: 0, Product: 1 },
  { month: "Jul", Engineering: 3, Marketing: 0, HR: 1, Finance: 1, Product: 0 },
  { month: "Aug", Engineering: 1, Marketing: 2, HR: 0, Finance: 0, Product: 1 },
  { month: "Sep", Engineering: 4, Marketing: 1, HR: 0, Finance: 1, Product: 2 },
  { month: "Oct", Engineering: 2, Marketing: 1, HR: 1, Finance: 0, Product: 1 },
  { month: "Nov", Engineering: 1, Marketing: 0, HR: 0, Finance: 0, Product: 0 },
  { month: "Dec", Engineering: 0, Marketing: 0, HR: 0, Finance: 0, Product: 0 },
  { month: "Jan", Engineering: 5, Marketing: 2, HR: 1, Finance: 1, Product: 2 },
  { month: "Feb", Engineering: 3, Marketing: 1, HR: 0, Finance: 0, Product: 1 },
  { month: "Mar", Engineering: 2, Marketing: 1, HR: 0, Finance: 1, Product: 1 },
  { month: "Apr", Engineering: 4, Marketing: 2, HR: 1, Finance: 0, Product: 1 },
  { month: "May", Engineering: 2, Marketing: 1, HR: 0, Finance: 1, Product: 0 },
];

// Monthly leave requests by type (last 12 months)
export const monthlyLeavesByType: Array<{ month: string; Annual: number; Sick: number; Personal: number }> = [
  { month: "Jun", Annual: 18, Sick: 6, Personal: 4 },
  { month: "Jul", Annual: 28, Sick: 5, Personal: 3 },
  { month: "Aug", Annual: 32, Sick: 4, Personal: 5 },
  { month: "Sep", Annual: 14, Sick: 7, Personal: 3 },
  { month: "Oct", Annual: 11, Sick: 9, Personal: 4 },
  { month: "Nov", Annual: 16, Sick: 12, Personal: 6 },
  { month: "Dec", Annual: 24, Sick: 14, Personal: 8 },
  { month: "Jan", Annual: 9,  Sick: 16, Personal: 5 },
  { month: "Feb", Annual: 10, Sick: 13, Personal: 4 },
  { month: "Mar", Annual: 13, Sick: 8,  Personal: 5 },
  { month: "Apr", Annual: 17, Sick: 6,  Personal: 4 },
  { month: "May", Annual: 21, Sick: 5,  Personal: 5 },
];

// Helper: get an employee's effective gross salary at a given date (uses salaryHistory + fallback)
export function salaryAt(employeeId: string, dateISO: string): number {
  const history = salaryHistory[employeeId] ?? [];
  const applicable = history.filter((s) => s.effectiveDate <= dateISO);
  if (applicable.length > 0) {
    return applicable[applicable.length - 1].newGross;
  }
  const emp = employees.find((e) => e.id === employeeId);
  return emp?.salary ?? 0;
}

export const teamsList: string[] = Array.from(
  new Set(Object.values(employeeExtras).map((x) => x.team))
);

export const recruitmentPipeline = [
  {
    id: "r1",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    applicantCount: 45,
    stages: { sourcing: 20, interview: 15, offer: 2, hired: 1 },
  },
  {
    id: "r2",
    title: "Account Executive",
    department: "Sales",
    applicantCount: 82,
    stages: { sourcing: 50, interview: 25, offer: 4, hired: 2 },
  },
  {
    id: "r3",
    title: "Product Designer",
    department: "Design",
    applicantCount: 120,
    stages: { sourcing: 90, interview: 20, offer: 1, hired: 0 },
  },
  {
    id: "r4",
    title: "HR Business Partner",
    department: "HR",
    applicantCount: 35,
    stages: { sourcing: 15, interview: 12, offer: 0, hired: 0 },
  },
];
