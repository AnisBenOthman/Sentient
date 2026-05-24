const STORAGE_KEY = "hris_promotion_requests";

export type PromotionRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  currentRole: string;
  newRole: string;
  currentSalary: number;
  newSalary: number;
  salaryDelta: number;
  salaryDeltaPct: number;
  currentTeamBudget: number;
  newTeamBudget: number;
  budgetImpactPct: number;
  responsibilities: string[];
  submittedAt: string;
  status: "Pending";
};

// Seed data — used when localStorage has no existing requests
const SEED_REQUESTS: PromotionRequest[] = [
  {
    id: "seed-1",
    employeeId: "11",
    employeeName: "Kai Torres",
    currentRole: "Backend Engineer",
    newRole: "Senior Backend Engineer",
    currentSalary: 130000,
    newSalary: 150000,
    salaryDelta: 20000,
    salaryDeltaPct: 15.38,
    currentTeamBudget: 415000,
    newTeamBudget: 435000,
    budgetImpactPct: 4.82,
    responsibilities: ["Lead backend architecture design", "Mentor junior engineers", "Drive code quality standards"],
    submittedAt: "2024-02-15",
    status: "Pending",
  },
  {
    id: "seed-2",
    employeeId: "15",
    employeeName: "Clara Reyes",
    currentRole: "Brand Designer",
    newRole: "Senior Brand Designer",
    currentSalary: 95000,
    newSalary: 108000,
    salaryDelta: 13000,
    salaryDeltaPct: 13.68,
    currentTeamBudget: 358000,
    newTeamBudget: 371000,
    budgetImpactPct: 3.63,
    responsibilities: ["Own brand system end-to-end", "Lead visual direction for campaigns"],
    submittedAt: "2024-03-20",
    status: "Pending",
  },
  {
    id: "seed-3",
    employeeId: "6",
    employeeName: "Janet",
    currentRole: "People Operations Manager",
    newRole: "Senior People Operations Manager",
    currentSalary: 95000,
    newSalary: 105000,
    salaryDelta: 10000,
    salaryDeltaPct: 10.53,
    currentTeamBudget: 322000,
    newTeamBudget: 332000,
    budgetImpactPct: 3.11,
    responsibilities: ["Drive global HR process improvements", "Lead onboarding redesign"],
    submittedAt: "2024-05-10",
    status: "Pending",
  },
  {
    id: "seed-4",
    employeeId: "8",
    employeeName: "Derek",
    currentRole: "Accountant",
    newRole: "Senior Accountant",
    currentSalary: 90000,
    newSalary: 101000,
    salaryDelta: 11000,
    salaryDeltaPct: 12.22,
    currentTeamBudget: 275000,
    newTeamBudget: 286000,
    budgetImpactPct: 4.0,
    responsibilities: ["Own month-end close process", "Review junior accountant work"],
    submittedAt: "2024-07-01",
    status: "Pending",
  },
  {
    id: "seed-5",
    employeeId: "10",
    employeeName: "Brent Norwalk",
    currentRole: "Product Manager",
    newRole: "Senior Product Manager",
    currentSalary: 130000,
    newSalary: 147000,
    salaryDelta: 17000,
    salaryDeltaPct: 13.08,
    currentTeamBudget: 418000,
    newTeamBudget: 435000,
    budgetImpactPct: 4.07,
    responsibilities: ["Own product roadmap for core platform", "Manage cross-functional delivery"],
    submittedAt: "2024-08-15",
    status: "Pending",
  },
  {
    id: "seed-6",
    employeeId: "13",
    employeeName: "Luis Ortega",
    currentRole: "Frontend Engineer",
    newRole: "Senior Frontend Engineer",
    currentSalary: 120000,
    newSalary: 140000,
    salaryDelta: 20000,
    salaryDeltaPct: 16.67,
    currentTeamBudget: 395000,
    newTeamBudget: 415000,
    budgetImpactPct: 5.06,
    responsibilities: ["Lead frontend guild", "Define component library standards"],
    submittedAt: "2024-10-01",
    status: "Pending",
  },
  {
    id: "seed-7",
    employeeId: "18",
    employeeName: "Amara Diallo",
    currentRole: "Senior Recruiter",
    newRole: "Principal Recruiter",
    currentSalary: 92000,
    newSalary: 106000,
    salaryDelta: 14000,
    salaryDeltaPct: 15.22,
    currentTeamBudget: 269000,
    newTeamBudget: 283000,
    budgetImpactPct: 5.2,
    responsibilities: ["Own executive hiring pipeline", "Build recruiter playbook"],
    submittedAt: "2024-11-20",
    status: "Pending",
  },
  {
    id: "seed-8",
    employeeId: "20",
    employeeName: "Leila Mansouri",
    currentRole: "Financial Analyst",
    newRole: "Senior Financial Analyst",
    currentSalary: 110000,
    newSalary: 125000,
    salaryDelta: 15000,
    salaryDeltaPct: 13.64,
    currentTeamBudget: 375000,
    newTeamBudget: 390000,
    budgetImpactPct: 4.0,
    responsibilities: ["Own quarterly FP&A reporting", "Lead budgeting cycle"],
    submittedAt: "2025-01-10",
    status: "Pending",
  },
  {
    id: "seed-9",
    employeeId: "16",
    employeeName: "Marcus Webb",
    currentRole: "SEO Lead",
    newRole: "Head of SEO",
    currentSalary: 105000,
    newSalary: 125000,
    salaryDelta: 20000,
    salaryDeltaPct: 19.05,
    currentTeamBudget: 308000,
    newTeamBudget: 328000,
    budgetImpactPct: 6.49,
    responsibilities: ["Define organic growth strategy", "Lead SEO team of 3", "Own SEO tool stack"],
    submittedAt: "2025-02-28",
    status: "Pending",
  },
  {
    id: "seed-10",
    employeeId: "12",
    employeeName: "Priya Sharma",
    currentRole: "DevOps Engineer",
    newRole: "Senior DevOps Engineer",
    currentSalary: 145000,
    newSalary: 165000,
    salaryDelta: 20000,
    salaryDeltaPct: 13.79,
    currentTeamBudget: 415000,
    newTeamBudget: 435000,
    budgetImpactPct: 4.82,
    responsibilities: ["Lead cloud infrastructure design", "Drive CI/CD maturity roadmap"],
    submittedAt: "2025-03-15",
    status: "Pending",
  },
  {
    id: "seed-11",
    employeeId: "22",
    employeeName: "Sam Foster",
    currentRole: "UX Designer",
    newRole: "Senior UX Designer",
    currentSalary: 115000,
    newSalary: 130000,
    salaryDelta: 15000,
    salaryDeltaPct: 13.04,
    currentTeamBudget: 323000,
    newTeamBudget: 338000,
    budgetImpactPct: 4.64,
    responsibilities: ["Own design system", "Lead user research cycles"],
    submittedAt: "2025-04-05",
    status: "Pending",
  },
  {
    id: "seed-12",
    employeeId: "21",
    employeeName: "Ryo Nakamura",
    currentRole: "Compliance Analyst",
    newRole: "Senior Compliance Analyst",
    currentSalary: 95000,
    newSalary: 107000,
    salaryDelta: 12000,
    salaryDeltaPct: 12.63,
    currentTeamBudget: 275000,
    newTeamBudget: 287000,
    budgetImpactPct: 4.36,
    responsibilities: ["Own regulatory reporting", "Lead internal audit preparation"],
    submittedAt: "2025-05-01",
    status: "Pending",
  },
];

export function getPromotionRequests(): PromotionRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_REQUESTS));
      return SEED_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PromotionRequest[]) : [];
  } catch {
    return SEED_REQUESTS;
  }
}

export function savePromotionRequest(req: PromotionRequest) {
  const all = getPromotionRequests();
  all.unshift(req);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable — no-op */
  }
}
