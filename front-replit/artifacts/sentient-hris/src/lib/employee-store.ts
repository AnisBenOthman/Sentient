const STORAGE_KEY = "hris_employee_overrides_v2";
const SKILLS_STORAGE_KEY = "hris_employee_skills_v2";

export type SkillEntry = { skill: string; level: number };

export type EmployeeOverride = {
  name: string;
  role: string;
  department: string;
  status: string;
  phone: string;
  contractType: string;
  positionLevel: string;
  maritalStatus: string;
  educationLevel: string;
  educationField: string;
  team: string;
  employeeCode?: string;
  dateOfBirth?: string;
  netSalary?: number;
};

function readAll(): Record<string, EmployeeOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(overrides: Record<string, EmployeeOverride>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
  }
}

export function getOverride(id: string): EmployeeOverride | null {
  return readAll()[id] ?? null;
}

export function setOverride(id: string, data: EmployeeOverride) {
  const all = readAll();
  all[id] = data;
  writeAll(all);
}

function readAllSkills(): Record<string, SkillEntry[]> {
  try {
    const raw = localStorage.getItem(SKILLS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAllSkills(data: Record<string, SkillEntry[]>) {
  try {
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(data));
  } catch {
  }
}

export function getSkillsOverride(id: string): SkillEntry[] | null {
  const all = readAllSkills();
  return all[id] ?? null;
}

export function setSkillsOverride(id: string, skills: SkillEntry[]) {
  const all = readAllSkills();
  all[id] = skills;
  writeAllSkills(all);
}

export function applyOverrides<T extends { id: string; name: string; role: string; department: string; status: string }>(
  employees: T[]
): T[] {
  const all = readAll();
  return employees.map((e) => {
    const override = all[e.id];
    return override ? { ...e, ...override } : e;
  });
}
