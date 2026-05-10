import { useEffect, useState, useCallback } from "react";

const UPDATE_EVENT = "performance-reviews-updated";

export type SatisfactionLevel = 1 | 2 | 3 | 4 | 5;
export type PerformanceRating = 1 | 2 | 3 | 4 | 5;

export const SATISFACTION_LABELS: Record<SatisfactionLevel, string> = {
  1: "VERY_DISSATISFIED",
  2: "DISSATISFIED",
  3: "NEUTRAL",
  4: "SATISFIED",
  5: "VERY_SATISFIED",
};

export const PERFORMANCE_RATING_LABELS: Record<PerformanceRating, string> = {
  1: "UNACCEPTABLE",
  2: "NEEDS_IMPROVEMENT",
  3: "MEETS_EXPECTATIONS",
  4: "EXCEEDS_EXPECTATIONS",
  5: "ABOVE_AND_BEYOND",
};

export type PerformanceReview = {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string;
  reviewerName: string;
  reviewDate: string; // ISO yyyy-mm-dd
  // Org context for this review
  businessUnitId?: string;
  businessUnitName?: string;
  department?: string;
  team?: string;
  environmentSatisfaction: SatisfactionLevel;
  jobSatisfaction: SatisfactionLevel;
  relationshipSatisfaction: SatisfactionLevel;
  trainingOpportunitiesTaken: number;
  workLifeBalance: SatisfactionLevel;
  selfRating: PerformanceRating;
  managerRating: PerformanceRating;
  comments: string;
  createdAt: string; // ISO datetime
};

const SEED_REVIEWS: PerformanceReview[] = [
  // ── India — Bengaluru (in-blr) ──────────────────────────────────────────────
  {
    id: "seed-pr-1",
    employeeId: "2",
    employeeName: "Chidi Anagonye",
    reviewerId: "1",
    reviewerName: "Eleanor Vance",
    reviewDate: "2026-02-14",
    businessUnitId: "in-blr",
    businessUnitName: "India — Bengaluru",
    department: "Engineering",
    team: "Backend Engineering",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 4,
    comments: "Strong technical contributions on the payments service refactor. Mentoring junior engineers effectively.",
    createdAt: "2026-02-14T10:00:00.000Z",
  },
  {
    id: "seed-pr-2",
    employeeId: "10",
    employeeName: "Brent Norwalk",
    reviewerId: "9",
    reviewerName: "Simone Garnett",
    reviewDate: "2026-01-20",
    businessUnitId: "in-blr",
    businessUnitName: "India — Bengaluru",
    department: "Product",
    team: "Product Management",
    environmentSatisfaction: 3,
    jobSatisfaction: 4,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 3,
    selfRating: 3,
    managerRating: 4,
    comments: "Solid quarter shipping the onboarding redesign. Could invest more in cross-team communication.",
    createdAt: "2026-01-20T15:30:00.000Z",
  },
  {
    id: "seed-pr-11",
    employeeId: "11",
    employeeName: "Kai Torres",
    reviewerId: "2",
    reviewerName: "Chidi Anagonye",
    reviewDate: "2026-02-28",
    businessUnitId: "in-blr",
    businessUnitName: "India — Bengaluru",
    department: "Engineering",
    team: "Backend Engineering",
    environmentSatisfaction: 4,
    jobSatisfaction: 3,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 4,
    selfRating: 3,
    managerRating: 3,
    comments: "Growing steadily. Needs to take more ownership on complex tickets and improve test coverage.",
    createdAt: "2026-02-28T11:00:00.000Z",
  },
  {
    id: "seed-pr-24",
    employeeId: "24",
    employeeName: "Raj Patel",
    reviewerId: "9",
    reviewerName: "Simone Garnett",
    reviewDate: "2026-03-10",
    businessUnitId: "in-blr",
    businessUnitName: "India — Bengaluru",
    department: "Product",
    team: "Product Strategy",
    environmentSatisfaction: 5,
    jobSatisfaction: 4,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 5,
    selfRating: 4,
    managerRating: 4,
    comments: "Excellent user research on the mobile checkout flow. Insights directly shaped Q1 priorities.",
    createdAt: "2026-03-10T08:45:00.000Z",
  },
  // ── Europe — Dublin (eu-dub) ─────────────────────────────────────────────────
  {
    id: "seed-pr-3",
    employeeId: "13",
    employeeName: "Luis Ortega",
    reviewerId: "2",
    reviewerName: "Chidi Anagonye",
    reviewDate: "2026-03-05",
    businessUnitId: "eu-dub",
    businessUnitName: "Europe — Dublin",
    department: "Engineering",
    team: "Backend Engineering",
    environmentSatisfaction: 5,
    jobSatisfaction: 5,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 4,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 5,
    comments: "Exceeded expectations delivering the component library that unblocked the backend team's API work. Reliable cross-functional contributor across the Dublin engineering group.",
    createdAt: "2026-03-05T09:15:00.000Z",
  },
  {
    id: "seed-pr-7",
    employeeId: "7",
    employeeName: "Mindy St. Claire",
    reviewerId: "0",
    reviewerName: "Sarah Chen",
    reviewDate: "2026-01-15",
    businessUnitId: "eu-dub",
    businessUnitName: "Europe — Dublin",
    department: "Finance",
    team: "FP&A",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 3,
    selfRating: 5,
    managerRating: 5,
    comments: "Flawless audit preparation and year-end close. Critical to the board's confidence in our financial reporting.",
    createdAt: "2026-01-15T14:00:00.000Z",
  },
  {
    id: "seed-pr-15",
    employeeId: "15",
    employeeName: "Clara Reyes",
    reviewerId: "3",
    reviewerName: "Tahani Al-Jamil",
    reviewDate: "2026-02-20",
    businessUnitId: "eu-dub",
    businessUnitName: "Europe — Dublin",
    department: "Marketing",
    team: "Brand & Campaigns",
    environmentSatisfaction: 5,
    jobSatisfaction: 5,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 4,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 5,
    comments: "Delivered the rebrand ahead of schedule. Exceptional eye for consistency across all brand assets.",
    createdAt: "2026-02-20T10:30:00.000Z",
  },
  {
    id: "seed-pr-20",
    employeeId: "20",
    employeeName: "Leila Mansouri",
    reviewerId: "7",
    reviewerName: "Mindy St. Claire",
    reviewDate: "2026-03-18",
    businessUnitId: "eu-dub",
    businessUnitName: "Europe — Dublin",
    department: "Finance",
    team: "FP&A",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 3,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 4,
    selfRating: 3,
    managerRating: 4,
    comments: "Reliable FP&A contributor. Would benefit from broader exposure to risk modelling in the next cycle.",
    createdAt: "2026-03-18T09:00:00.000Z",
  },
  {
    id: "seed-pr-23",
    employeeId: "23",
    employeeName: "Ines Dubois",
    reviewerId: "9",
    reviewerName: "Simone Garnett",
    reviewDate: "2026-02-10",
    businessUnitId: "eu-dub",
    businessUnitName: "Europe — Dublin",
    department: "Product",
    team: "Product Strategy",
    environmentSatisfaction: 4,
    jobSatisfaction: 5,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 4,
    comments: "Strong analytical rigour on the EMEA expansion data. Proactively surfaces insights before stakeholders ask.",
    createdAt: "2026-02-10T13:00:00.000Z",
  },
  // ── US — Seattle (us-sea) ────────────────────────────────────────────────────
  {
    id: "seed-pr-0",
    employeeId: "0",
    employeeName: "Sarah Chen",
    reviewerId: "5",
    reviewerName: "Michael Realman",
    reviewDate: "2026-01-08",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "Executive",
    team: "Executive Leadership",
    environmentSatisfaction: 5,
    jobSatisfaction: 5,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 3,
    selfRating: 5,
    managerRating: 5,
    comments: "Outstanding year for the company under Sarah's leadership. Revenue targets exceeded by 18%. Board engagement score at an all-time high.",
    createdAt: "2026-01-08T09:00:00.000Z",
  },
  {
    id: "seed-pr-1a",
    employeeId: "1",
    employeeName: "Eleanor Vance",
    reviewerId: "0",
    reviewerName: "Sarah Chen",
    reviewDate: "2026-01-10",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "Engineering",
    team: "Platform & Infrastructure",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 3,
    selfRating: 4,
    managerRating: 5,
    comments: "Scaled the engineering org from 8 to 14 engineers without a drop in velocity. Exceptional people leadership.",
    createdAt: "2026-01-10T16:00:00.000Z",
  },
  {
    id: "seed-pr-14",
    employeeId: "14",
    employeeName: "Anika Patel",
    reviewerId: "1",
    reviewerName: "Eleanor Vance",
    reviewDate: "2026-03-01",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "Engineering",
    team: "Platform & Infrastructure",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 5,
    selfRating: 3,
    managerRating: 3,
    comments: "Good onboarding progress for a first-year hire. Needs to build confidence presenting in cross-team reviews.",
    createdAt: "2026-03-01T10:15:00.000Z",
  },
  {
    id: "seed-pr-16",
    employeeId: "16",
    employeeName: "Marcus Webb",
    reviewerId: "3",
    reviewerName: "Tahani Al-Jamil",
    reviewDate: "2026-02-05",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "Marketing",
    team: "Digital Marketing",
    environmentSatisfaction: 3,
    jobSatisfaction: 4,
    relationshipSatisfaction: 3,
    trainingOpportunitiesTaken: 5,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 4,
    comments: "Organic traffic up 38% YoY. Invested heavily in his own learning — completed three SEO certifications this cycle.",
    createdAt: "2026-02-05T11:45:00.000Z",
  },
  {
    id: "seed-pr-19",
    employeeId: "19",
    employeeName: "Tom Nguyen",
    reviewerId: "5",
    reviewerName: "Michael Realman",
    reviewDate: "2026-02-25",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "HR",
    team: "Talent Acquisition",
    environmentSatisfaction: 4,
    jobSatisfaction: 3,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 4,
    selfRating: 3,
    managerRating: 3,
    comments: "Dependable HR generalist. Encourage him to take the lead on the next open benefits review cycle.",
    createdAt: "2026-02-25T09:30:00.000Z",
  },
  {
    id: "seed-pr-22",
    employeeId: "22",
    employeeName: "Sam Foster",
    reviewerId: "9",
    reviewerName: "Simone Garnett",
    reviewDate: "2026-03-22",
    businessUnitId: "us-sea",
    businessUnitName: "US — Seattle",
    department: "Product",
    team: "Product Management",
    environmentSatisfaction: 5,
    jobSatisfaction: 5,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 4,
    workLifeBalance: 4,
    selfRating: 5,
    managerRating: 5,
    comments: "The new design system raised the quality bar across all product surfaces. Sam is a collaborative force multiplier.",
    createdAt: "2026-03-22T14:00:00.000Z",
  },
  // ── LATAM — São Paulo (latam-sp) ─────────────────────────────────────────────
  {
    id: "seed-pr-4",
    employeeId: "4",
    employeeName: "Jason Mendoza",
    reviewerId: "3",
    reviewerName: "Tahani Al-Jamil",
    reviewDate: "2026-01-28",
    businessUnitId: "latam-sp",
    businessUnitName: "LATAM — São Paulo",
    department: "Marketing",
    team: "Digital Marketing",
    environmentSatisfaction: 3,
    jobSatisfaction: 3,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 1,
    workLifeBalance: 2,
    selfRating: 3,
    managerRating: 2,
    comments: "Currently on leave — partial review covering pre-leave performance. Return plan and updated goals to be set at restart.",
    createdAt: "2026-01-28T10:00:00.000Z",
  },
  // ── APAC — Singapore (apac-sg) ───────────────────────────────────────────────
  {
    id: "seed-pr-6",
    employeeId: "6",
    employeeName: "Janet",
    reviewerId: "5",
    reviewerName: "Michael Realman",
    reviewDate: "2026-02-18",
    businessUnitId: "apac-sg",
    businessUnitName: "APAC — Singapore",
    department: "HR",
    team: "HR Business Partners",
    environmentSatisfaction: 5,
    jobSatisfaction: 4,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 4,
    comments: "Indispensable to APAC onboarding operations. Manages complexity across three time zones with calm professionalism.",
    createdAt: "2026-02-18T07:00:00.000Z",
  },
  {
    id: "seed-pr-12",
    employeeId: "12",
    employeeName: "Priya Sharma",
    reviewerId: "1",
    reviewerName: "Eleanor Vance",
    reviewDate: "2026-03-12",
    businessUnitId: "apac-sg",
    businessUnitName: "APAC — Singapore",
    department: "Engineering",
    team: "Platform & Infrastructure",
    environmentSatisfaction: 4,
    jobSatisfaction: 5,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 5,
    workLifeBalance: 3,
    selfRating: 5,
    managerRating: 5,
    comments: "Zero P0 incidents for two consecutive quarters. Her SRE playbook has become the team standard globally.",
    createdAt: "2026-03-12T08:30:00.000Z",
  },
  {
    id: "seed-pr-18",
    employeeId: "18",
    employeeName: "Amara Diallo",
    reviewerId: "5",
    reviewerName: "Michael Realman",
    reviewDate: "2026-01-30",
    businessUnitId: "apac-sg",
    businessUnitName: "APAC — Singapore",
    department: "HR",
    team: "Talent Acquisition",
    environmentSatisfaction: 4,
    jobSatisfaction: 5,
    relationshipSatisfaction: 5,
    trainingOpportunitiesTaken: 3,
    workLifeBalance: 4,
    selfRating: 4,
    managerRating: 5,
    comments: "Closed 11 senior roles in Q4 with a 94% offer-acceptance rate. Exceptional sourcing strategy for APAC tech talent.",
    createdAt: "2026-01-30T06:00:00.000Z",
  },
  // ── Japan — Tokyo (jp-tyo) ───────────────────────────────────────────────────
  {
    id: "seed-pr-8",
    employeeId: "8",
    employeeName: "Derek",
    reviewerId: "7",
    reviewerName: "Mindy St. Claire",
    reviewDate: "2026-02-08",
    businessUnitId: "jp-tyo",
    businessUnitName: "Japan — Tokyo",
    department: "Finance",
    team: "Accounting & Compliance",
    environmentSatisfaction: 3,
    jobSatisfaction: 3,
    relationshipSatisfaction: 3,
    trainingOpportunitiesTaken: 1,
    workLifeBalance: 3,
    selfRating: 3,
    managerRating: 3,
    comments: "Accurate and thorough on month-end close. Should pursue JGAAP certification to expand scope in the Tokyo office.",
    createdAt: "2026-02-08T09:00:00.000Z",
  },
  {
    id: "seed-pr-21",
    employeeId: "21",
    employeeName: "Ryo Nakamura",
    reviewerId: "7",
    reviewerName: "Mindy St. Claire",
    reviewDate: "2026-03-25",
    businessUnitId: "jp-tyo",
    businessUnitName: "Japan — Tokyo",
    department: "Finance",
    team: "Accounting & Compliance",
    environmentSatisfaction: 4,
    jobSatisfaction: 4,
    relationshipSatisfaction: 4,
    trainingOpportunitiesTaken: 2,
    workLifeBalance: 5,
    selfRating: 4,
    managerRating: 4,
    comments: "Led the FSA compliance filing with no findings. His meticulous approach sets a high bar for the entire Tokyo team.",
    createdAt: "2026-03-25T10:00:00.000Z",
  },
];

function readAll(): PerformanceReview[] {
  return [...SEED_REVIEWS];
}

function writeAll(_reviews: PerformanceReview[]): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

function compareReviews(a: PerformanceReview, b: PerformanceReview): number {
  if (a.reviewDate !== b.reviewDate) {
    return a.reviewDate < b.reviewDate ? 1 : -1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return 0;
}

export function getPerformanceReviews(): PerformanceReview[] {
  return readAll().sort(compareReviews);
}

export function addPerformanceReview(review: PerformanceReview) {
  const all = readAll();
  all.unshift(review);
  writeAll(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

export function getReviewsForEmployee(employeeId: string): PerformanceReview[] {
  return readAll()
    .filter((r) => r.employeeId === employeeId)
    .sort(compareReviews);
}

export function usePerformanceReviews(): [PerformanceReview[], () => void] {
  const [reviews, setReviews] = useState<PerformanceReview[]>(() =>
    getPerformanceReviews()
  );

  const refresh = useCallback(() => {
    setReviews(getPerformanceReviews());
  }, []);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, [refresh]);

  return [reviews, refresh];
}

export function useEmployeePerformanceReviews(
  employeeId: string
): PerformanceReview[] {
  const [reviews] = usePerformanceReviews();
  return reviews.filter((r) => r.employeeId === employeeId);
}
