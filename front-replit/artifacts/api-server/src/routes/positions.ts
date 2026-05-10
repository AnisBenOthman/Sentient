import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

// ── In-memory data ────────────────────────────────────────────────────────────

type SkillCategory = "TECHNICAL" | "LEADERSHIP" | "BEHAVIORAL" | "DOMAIN" | "OTHER";
type RequirementLevel = "MANDATORY" | "EXPECTED" | "NICE_TO_HAVE";
type PositionLevel = "JUNIOR" | "MEDIUM" | "CONFIRMED" | "SENIOR_1" | "SENIOR_2" | "EXPERT";

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
}

interface Position {
  id: string;
  title: string;
  level: PositionLevel;
  isActive: boolean;
  isKeyPosition: boolean;
  department: string;
  team: string;
}

interface PositionSkill {
  id: string;
  positionId: string;
  skillId: string;
  skill: Skill;
  proficiency: number;
  requirementLevel: RequirementLevel;
}

interface SkillGapItem {
  skill: Skill;
  requiredProficiency: number;
  requirementLevel: RequirementLevel;
  acquiredProficiency: number | null;
  status: "MET" | "EXCEEDS" | "PARTIAL" | "MISSING";
}

const SKILLS: Skill[] = [
  { id: "sk-1",  name: "Backend",       category: "TECHNICAL"  },
  { id: "sk-2",  name: "Frontend",      category: "TECHNICAL"  },
  { id: "sk-3",  name: "DevOps",        category: "TECHNICAL"  },
  { id: "sk-4",  name: "Architecture",  category: "TECHNICAL"  },
  { id: "sk-5",  name: "Testing",       category: "TECHNICAL"  },
  { id: "sk-6",  name: "Data",          category: "TECHNICAL"  },
  { id: "sk-7",  name: "Excel",         category: "TECHNICAL"  },
  { id: "sk-8",  name: "Leadership",    category: "LEADERSHIP" },
  { id: "sk-9",  name: "Strategy",      category: "LEADERSHIP" },
  { id: "sk-10", name: "Roadmap",       category: "LEADERSHIP" },
  { id: "sk-11", name: "Agile",         category: "LEADERSHIP" },
  { id: "sk-12", name: "Communication", category: "BEHAVIORAL" },
  { id: "sk-13", name: "Recruiting",    category: "BEHAVIORAL" },
  { id: "sk-14", name: "L&D",           category: "BEHAVIORAL" },
  { id: "sk-15", name: "Compliance",    category: "BEHAVIORAL" },
  { id: "sk-16", name: "Payroll",       category: "BEHAVIORAL" },
  { id: "sk-17", name: "FP&A",          category: "DOMAIN"     },
  { id: "sk-18", name: "Accounting",    category: "DOMAIN"     },
  { id: "sk-19", name: "Reporting",     category: "DOMAIN"     },
  { id: "sk-20", name: "Risk",          category: "DOMAIN"     },
  { id: "sk-21", name: "Analytics",     category: "DOMAIN"     },
  { id: "sk-22", name: "SEO",           category: "DOMAIN"     },
  { id: "sk-23", name: "Social Media",  category: "DOMAIN"     },
  { id: "sk-24", name: "Copywriting",   category: "DOMAIN"     },
  { id: "sk-25", name: "Design",        category: "DOMAIN"     },
  { id: "sk-26", name: "Research",      category: "DOMAIN"     },
];

const SKILL_MAP = new Map<string, Skill>(SKILLS.map((s) => [s.id, s]));

const POSITIONS: Position[] = [
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

type SkillSpec = { skillId: string; proficiency: number; requirementLevel: RequirementLevel };

const DEFAULT_POSITION_SKILLS: Record<string, SkillSpec[]> = {
  "pos-1":  [
    { skillId: "sk-9",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-8",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-17", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 4, requirementLevel: "EXPECTED"     },
  ],
  "pos-2":  [
    { skillId: "sk-4",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-3",  proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-8",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-3":  [
    { skillId: "sk-1",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-3",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-4":  [
    { skillId: "sk-9",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-5":  [
    { skillId: "sk-23", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-9",  proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-6":  [
    { skillId: "sk-13", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-16", proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-7":  [
    { skillId: "sk-12", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-16", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-13", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-8":  [
    { skillId: "sk-17", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-20", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-7",  proficiency: 5, requirementLevel: "EXPECTED"     },
  ],
  "pos-9":  [
    { skillId: "sk-18", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-7",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-20", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-17", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-10": [
    { skillId: "sk-10", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-11", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", proficiency: 4, requirementLevel: "EXPECTED"     },
  ],
  "pos-11": [
    { skillId: "sk-11", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-10", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-12": [
    { skillId: "sk-1",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-6",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-3",  proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-4",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-13": [
    { skillId: "sk-3",  proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-5",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-2",  proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-14": [
    { skillId: "sk-2",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-5",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-4",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-3",  proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-15": [
    { skillId: "sk-3",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-4",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-1",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-6",  proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-5",  proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-2",  proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-16": [
    { skillId: "sk-25", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-9",  proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-22", proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-17": [
    { skillId: "sk-22", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-24", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-23", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-9",  proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-25", proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-18": [
    { skillId: "sk-24", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-9",  proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-23", proficiency: 4, requirementLevel: "EXPECTED"     },
    { skillId: "sk-22", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-25", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-19": [
    { skillId: "sk-13", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-16", proficiency: 1, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-20": [
    { skillId: "sk-12", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-15", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-13", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-14", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-16", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-21", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-21": [
    { skillId: "sk-17", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-7",  proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-20", proficiency: 2, requirementLevel: "EXPECTED"     },
    { skillId: "sk-15", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-22": [
    { skillId: "sk-15", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-20", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-18", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-19", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-7",  proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-17", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-23": [
    { skillId: "sk-25", proficiency: 5, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-12", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-10", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-11", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-24": [
    { skillId: "sk-21", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-26", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-10", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-11", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-25", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
  "pos-25": [
    { skillId: "sk-26", proficiency: 4, requirementLevel: "MANDATORY"    },
    { skillId: "sk-21", proficiency: 3, requirementLevel: "MANDATORY"    },
    { skillId: "sk-25", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-12", proficiency: 3, requirementLevel: "EXPECTED"     },
    { skillId: "sk-11", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
    { skillId: "sk-10", proficiency: 2, requirementLevel: "NICE_TO_HAVE" },
  ],
};

// Employee → positionId mapping
const EMPLOYEE_POSITIONS: Record<string, string> = {
  "0": "pos-1",  "1": "pos-2",  "2": "pos-3",  "3": "pos-4",
  "4": "pos-5",  "5": "pos-6",  "6": "pos-7",  "7": "pos-8",
  "8": "pos-9",  "9": "pos-10", "10": "pos-11","11": "pos-12",
  "12":"pos-13","13": "pos-14","14": "pos-15","15": "pos-16",
  "16":"pos-17","17": "pos-18","18": "pos-19","19": "pos-20",
  "20":"pos-21","21": "pos-22","22": "pos-23","23": "pos-24",
  "24":"pos-25",
};

// Employee skills (mirrors mock-data.ts)
const EMPLOYEE_SKILLS: Record<string, Array<{ skill: string; level: number }>> = {
  "0":  [{ skill:"Strategy",level:5},{skill:"Leadership",level:5},{skill:"Communication",level:5},{skill:"FP&A",level:4},{skill:"Analytics",level:4}],
  "1":  [{ skill:"Architecture",level:5},{skill:"Backend",level:4},{skill:"DevOps",level:4},{skill:"Leadership",level:4},{skill:"Testing",level:4},{skill:"Data",level:4}],
  "2":  [{ skill:"Backend",level:5},{skill:"Architecture",level:4},{skill:"Testing",level:4},{skill:"DevOps",level:3},{skill:"Data",level:4},{skill:"Frontend",level:2}],
  "3":  [{ skill:"Strategy",level:5},{skill:"Copywriting",level:4},{skill:"Analytics",level:4},{skill:"Social Media",level:4},{skill:"Design",level:3},{skill:"SEO",level:4}],
  "4":  [{ skill:"Social Media",level:5},{skill:"Copywriting",level:4},{skill:"Analytics",level:3},{skill:"SEO",level:3},{skill:"Design",level:4},{skill:"Strategy",level:3}],
  "5":  [{ skill:"Recruiting",level:4},{skill:"Compliance",level:4},{skill:"Communication",level:5},{skill:"Analytics",level:4},{skill:"L&D",level:4},{skill:"Payroll",level:4}],
  "6":  [{ skill:"Communication",level:4},{skill:"Payroll",level:3},{skill:"Compliance",level:4},{skill:"Recruiting",level:3},{skill:"L&D",level:3},{skill:"Analytics",level:3}],
  "7":  [{ skill:"FP&A",level:5},{skill:"Accounting",level:4},{skill:"Compliance",level:4},{skill:"Reporting",level:5},{skill:"Risk",level:4},{skill:"Excel",level:5}],
  "8":  [{ skill:"Accounting",level:4},{skill:"Excel",level:4},{skill:"Reporting",level:4},{skill:"Compliance",level:4},{skill:"Risk",level:3},{skill:"FP&A",level:3}],
  "9":  [{ skill:"Roadmap",level:5},{skill:"Research",level:4},{skill:"Analytics",level:4},{skill:"Agile",level:5},{skill:"Design",level:4},{skill:"Communication",level:4}],
  "10": [{ skill:"Agile",level:4},{skill:"Roadmap",level:4},{skill:"Research",level:4},{skill:"Analytics",level:4},{skill:"Communication",level:4},{skill:"Design",level:3}],
  "11": [{ skill:"Backend",level:4},{skill:"Testing",level:3},{skill:"Data",level:3},{skill:"DevOps",level:2},{skill:"Frontend",level:2},{skill:"Architecture",level:2}],
  "12": [{ skill:"DevOps",level:5},{skill:"Architecture",level:3},{skill:"Backend",level:3},{skill:"Testing",level:3},{skill:"Data",level:2},{skill:"Frontend",level:1}],
  "13": [{ skill:"Frontend",level:4},{skill:"Testing",level:3},{skill:"Backend",level:2},{skill:"Design",level:3},{skill:"Architecture",level:2},{skill:"DevOps",level:1}],
  "14": [{ skill:"DevOps",level:3},{skill:"Architecture",level:3},{skill:"Backend",level:3},{skill:"Data",level:2},{skill:"Testing",level:2},{skill:"Frontend",level:1}],
  "15": [{ skill:"Design",level:5},{skill:"Copywriting",level:3},{skill:"Social Media",level:3},{skill:"Strategy",level:2},{skill:"Analytics",level:2},{skill:"SEO",level:1}],
  "16": [{ skill:"SEO",level:5},{skill:"Analytics",level:4},{skill:"Copywriting",level:3},{skill:"Social Media",level:3},{skill:"Strategy",level:2},{skill:"Design",level:1}],
  "17": [{ skill:"Copywriting",level:5},{skill:"Strategy",level:3},{skill:"Social Media",level:4},{skill:"SEO",level:3},{skill:"Analytics",level:2},{skill:"Design",level:2}],
  "18": [{ skill:"Recruiting",level:5},{skill:"Communication",level:4},{skill:"Analytics",level:3},{skill:"Compliance",level:2},{skill:"L&D",level:2},{skill:"Payroll",level:1}],
  "19": [{ skill:"Communication",level:4},{skill:"Compliance",level:3},{skill:"Recruiting",level:3},{skill:"L&D",level:3},{skill:"Payroll",level:2},{skill:"Analytics",level:2}],
  "20": [{ skill:"FP&A",level:4},{skill:"Reporting",level:4},{skill:"Excel",level:4},{skill:"Accounting",level:3},{skill:"Risk",level:2},{skill:"Compliance",level:2}],
  "21": [{ skill:"Compliance",level:4},{skill:"Risk",level:4},{skill:"Accounting",level:3},{skill:"Reporting",level:3},{skill:"Excel",level:3},{skill:"FP&A",level:2}],
  "22": [{ skill:"Design",level:5},{skill:"Research",level:4},{skill:"Communication",level:3},{skill:"Analytics",level:3},{skill:"Roadmap",level:2},{skill:"Agile",level:2}],
  "23": [{ skill:"Analytics",level:4},{skill:"Research",level:4},{skill:"Roadmap",level:3},{skill:"Communication",level:3},{skill:"Agile",level:3},{skill:"Design",level:2}],
  "24": [{ skill:"Research",level:4},{skill:"Analytics",level:3},{skill:"Design",level:3},{skill:"Communication",level:3},{skill:"Agile",level:2},{skill:"Roadmap",level:2}],
};

// In-memory override store (resets on server restart, per spec)
const positionSkillsOverrides = new Map<string, PositionSkill[]>();

function resolvePositionSkills(positionId: string): PositionSkill[] {
  if (positionSkillsOverrides.has(positionId)) {
    return positionSkillsOverrides.get(positionId)!;
  }
  const defaults = DEFAULT_POSITION_SKILLS[positionId] ?? [];
  return defaults.map((d, i) => {
    const skill = SKILL_MAP.get(d.skillId);
    if (!skill) return null;
    return { id: `${positionId}-${d.skillId}-${i}`, positionId, skillId: d.skillId, skill, proficiency: d.proficiency, requirementLevel: d.requirementLevel };
  }).filter(Boolean) as PositionSkill[];
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/skills
router.get("/skills", (_req, res) => {
  res.json({ data: SKILLS });
});

// GET /api/positions
router.get("/positions", (_req, res) => {
  const data = POSITIONS.map((p) => ({
    ...p,
    skillCount: resolvePositionSkills(p.id).length,
  }));
  res.json({ data });
});

const VALID_LEVELS: PositionLevel[] = ["JUNIOR", "MEDIUM", "CONFIRMED", "SENIOR_1", "SENIOR_2", "EXPERT"];

// POST /api/positions  — create a new position
router.post("/positions", (req, res) => {
  const { title, level, isActive, isKeyPosition } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!VALID_LEVELS.includes(level)) {
    return res.status(400).json({ error: `level must be one of ${VALID_LEVELS.join(", ")}` });
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive must be a boolean" });
  }
  if (isKeyPosition !== undefined && typeof isKeyPosition !== "boolean") {
    return res.status(400).json({ error: "isKeyPosition must be a boolean" });
  }
  const newPos: Position = {
    id: `pos-${randomUUID().slice(0, 8)}`,
    title: title.trim(),
    level,
    isActive: isActive ?? true,
    isKeyPosition: isKeyPosition ?? false,
  };
  POSITIONS.push(newPos);
  return res.status(201).json({ data: { ...newPos, skillCount: 0 } });
});

// PATCH /api/positions/:id  — update position metadata (title/level/key/active)
router.patch("/positions/:id", (req, res) => {
  const { id } = req.params;
  const pos = POSITIONS.find((p) => p.id === id);
  if (!pos) return res.status(404).json({ error: "Position not found" });

  const { title, level, isActive, isKeyPosition } = req.body ?? {};
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "title must be a non-empty string" });
    }
    pos.title = title.trim();
  }
  if (level !== undefined) {
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ error: `level must be one of ${VALID_LEVELS.join(", ")}` });
    }
    pos.level = level;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });
    pos.isActive = isActive;
  }
  if (isKeyPosition !== undefined) {
    if (typeof isKeyPosition !== "boolean") return res.status(400).json({ error: "isKeyPosition must be a boolean" });
    pos.isKeyPosition = isKeyPosition;
  }

  return res.json({ data: { ...pos, skillCount: resolvePositionSkills(pos.id).length } });
});

// DELETE /api/positions/:id  — delete a position (and any skill overrides + employee links)
router.delete("/positions/:id", (req, res) => {
  const { id } = req.params;
  const idx = POSITIONS.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Position not found" });
  POSITIONS.splice(idx, 1);
  positionSkillsOverrides.delete(id);
  // Unlink any employees pointing to this position
  for (const empId of Object.keys(EMPLOYEE_POSITIONS)) {
    if (EMPLOYEE_POSITIONS[empId] === id) delete EMPLOYEE_POSITIONS[empId];
  }
  return res.status(204).send();
});

// GET /api/positions/:id/skills
router.get("/positions/:id/skills", (req, res) => {
  const { id } = req.params;
  const pos = POSITIONS.find((p) => p.id === id);
  if (!pos) return res.status(404).json({ error: "Position not found" });
  return res.json({ data: resolvePositionSkills(id) });
});

// PUT /api/positions/:id/skills  (bulk-replace)
router.put("/positions/:id/skills", (req, res) => {
  const { id } = req.params;
  const pos = POSITIONS.find((p) => p.id === id);
  if (!pos) return res.status(404).json({ error: "Position not found" });

  const items: Array<{ skillId: string; proficiency: number; requirementLevel: RequirementLevel }> = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Body must be an array" });

  try {
    const resolved: PositionSkill[] = items.map((item, i) => {
      const skill = SKILL_MAP.get(item.skillId);
      if (!skill) throw new Error(`Unknown skill id: ${item.skillId}`);
      return { id: `${id}-${item.skillId}-${i}`, positionId: id, skillId: item.skillId, skill, proficiency: item.proficiency, requirementLevel: item.requirementLevel };
    });
    positionSkillsOverrides.set(id, resolved);
    return res.json({ data: resolved });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
});

// DELETE /api/positions/:id/skills/:skillId
router.delete("/positions/:id/skills/:skillId", (req, res) => {
  const { id, skillId } = req.params;
  const current = resolvePositionSkills(id);
  const updated = current.filter((ps) => ps.skillId !== skillId);
  positionSkillsOverrides.set(id, updated);
  res.json({ data: updated });
});

// GET /api/employees/:id/skills-gap
router.get("/employees/:id/skills-gap", (req, res) => {
  const { id } = req.params;
  const positionId = EMPLOYEE_POSITIONS[id];
  if (!positionId) return res.status(404).json({ error: "No position assigned to this employee" });

  const position = POSITIONS.find((p) => p.id === positionId);
  if (!position) return res.status(404).json({ error: "Position not found" });

  const employeeSkills = EMPLOYEE_SKILLS[id] ?? [];
  const skillMap = new Map<string, number>(employeeSkills.map((s) => [s.skill, s.level]));

  const positionSkills = resolvePositionSkills(positionId);
  const items: SkillGapItem[] = positionSkills.map((ps) => {
    const acquired = skillMap.get(ps.skill.name) ?? null;
    let status: SkillGapItem["status"];
    if (acquired === null)           status = "MISSING";
    else if (acquired > ps.proficiency) status = "EXCEEDS";
    else if (acquired === ps.proficiency) status = "MET";
    else                             status = "PARTIAL";
    return { skill: ps.skill, requiredProficiency: ps.proficiency, requirementLevel: ps.requirementLevel, acquiredProficiency: acquired, status };
  });

  const met     = items.filter((i) => i.status === "MET" || i.status === "EXCEEDS").length;
  const exceeds = items.filter((i) => i.status === "EXCEEDS").length;
  const partial = items.filter((i) => i.status === "PARTIAL" || i.status === "MISSING").length;

  return res.json({ data: { employeeId: id, positionId, position, items, summary: { met, partial, exceeds } } });
});

export default router;
