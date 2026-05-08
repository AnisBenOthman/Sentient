import { useState, useEffect, useCallback } from "react";

// ── Leave Type ────────────────────────────────────────────────────────────────
export type LeaveTypeConfig = {
  id: string;
  name: string;
  paid: boolean;
  maxDaysPerYear: number;
  color: string;
  enabled: boolean;
};

const DEFAULT_LEAVE_TYPES: LeaveTypeConfig[] = [
  { id: "annual",    name: "Annual",    paid: true,  maxDaysPerYear: 20, color: "blue",   enabled: true },
  { id: "sick",      name: "Sick",      paid: true,  maxDaysPerYear: 15, color: "red",    enabled: true },
  { id: "personal",  name: "Personal",  paid: true,  maxDaysPerYear: 5,  color: "purple", enabled: true },
  { id: "maternity", name: "Maternity", paid: true,  maxDaysPerYear: 90, color: "pink",   enabled: true },
  { id: "paternity", name: "Paternity", paid: true,  maxDaysPerYear: 15, color: "cyan",   enabled: true },
  { id: "unpaid",    name: "Unpaid",    paid: false, maxDaysPerYear: 0,  color: "gray",   enabled: true },
];

const LT_KEY = "sentient_hris_leave_types";

function loadLeaveTypes(): LeaveTypeConfig[] {
  try {
    const raw = localStorage.getItem(LT_KEY);
    if (raw) return JSON.parse(raw) as LeaveTypeConfig[];
  } catch {}
  return DEFAULT_LEAVE_TYPES;
}

function saveLeaveTypes(types: LeaveTypeConfig[]) {
  localStorage.setItem(LT_KEY, JSON.stringify(types));
}

// ── Holiday ───────────────────────────────────────────────────────────────────
export type Holiday = {
  id: string;
  name: string;
  date: string;
  description: string;
  recurring: boolean;
};

const DEFAULT_HOLIDAYS: Holiday[] = [
  { id: "h1",  name: "New Year's Day",          date: "2026-01-01", description: "",                     recurring: true  },
  { id: "h2",  name: "Martin Luther King Jr. Day", date: "2026-01-19", description: "Third Monday in January", recurring: true },
  { id: "h3",  name: "Presidents' Day",          date: "2026-02-16", description: "Third Monday in February", recurring: true },
  { id: "h4",  name: "Memorial Day",             date: "2026-05-25", description: "Last Monday in May",    recurring: true  },
  { id: "h5",  name: "Independence Day",         date: "2026-07-04", description: "",                     recurring: true  },
  { id: "h6",  name: "Labor Day",                date: "2026-09-07", description: "First Monday in September", recurring: true },
  { id: "h7",  name: "Thanksgiving Day",         date: "2026-11-26", description: "Fourth Thursday in November", recurring: true },
  { id: "h8",  name: "Christmas Day",            date: "2026-12-25", description: "",                     recurring: true  },
];

const HOL_KEY = "sentient_hris_holidays";

function loadHolidays(): Holiday[] {
  try {
    const raw = localStorage.getItem(HOL_KEY);
    if (raw) return JSON.parse(raw) as Holiday[];
  } catch {}
  return DEFAULT_HOLIDAYS;
}

function saveHolidays(holidays: Holiday[]) {
  localStorage.setItem(HOL_KEY, JSON.stringify(holidays));
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useLeaveTypes() {
  const [types, setTypesState] = useState<LeaveTypeConfig[]>(loadLeaveTypes);

  const persist = useCallback((next: LeaveTypeConfig[]) => {
    saveLeaveTypes(next);
    setTypesState(next);
  }, []);

  const addType = useCallback((t: Omit<LeaveTypeConfig, "id">) => {
    const id = `lt_${Date.now()}`;
    persist([...loadLeaveTypes(), { id, ...t }]);
  }, [persist]);

  const updateType = useCallback((id: string, patch: Partial<Omit<LeaveTypeConfig, "id">>) => {
    persist(loadLeaveTypes().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, [persist]);

  const deleteType = useCallback((id: string) => {
    persist(loadLeaveTypes().filter((t) => t.id !== id));
  }, [persist]);

  return { types, addType, updateType, deleteType };
}

export function useHolidays() {
  const [holidays, setHolidaysState] = useState<Holiday[]>(loadHolidays);

  const persist = useCallback((next: Holiday[]) => {
    saveHolidays(next);
    setHolidaysState(next);
  }, []);

  const addHoliday = useCallback((h: Omit<Holiday, "id">) => {
    const id = `hol_${Date.now()}`;
    persist([...loadHolidays(), { id, ...h }].sort((a, b) => a.date.localeCompare(b.date)));
  }, [persist]);

  const updateHoliday = useCallback((id: string, patch: Partial<Omit<Holiday, "id">>) => {
    persist(loadHolidays().map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, [persist]);

  const deleteHoliday = useCallback((id: string) => {
    persist(loadHolidays().filter((h) => h.id !== id));
  }, [persist]);

  return { holidays, addHoliday, updateHoliday, deleteHoliday };
}

// ── Colour helpers ─────────────────────────────────────────────────────────────
export const COLOUR_OPTIONS = [
  { value: "blue",   label: "Blue",   bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "red",    label: "Red",    bg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  { value: "green",  label: "Green",  bg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "purple", label: "Purple", bg: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "pink",   label: "Pink",   bg: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  { value: "cyan",   label: "Cyan",   bg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  { value: "orange", label: "Orange", bg: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "yellow", label: "Yellow", bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { value: "gray",   label: "Gray",   bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
];

export function colourClass(color: string) {
  return COLOUR_OPTIONS.find((c) => c.value === color)?.bg ?? "bg-gray-100 text-gray-700";
}
