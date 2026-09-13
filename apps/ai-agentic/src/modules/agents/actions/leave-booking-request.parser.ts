/**
 * Deterministic booking-intent and date-range extraction for the Leave Agent's
 * Reason phase (spec 017 T027).
 *
 * WHY deterministic rather than asking the LLM: the dates that reach the frozen
 * payload are the dates that get booked. A parse the developer can read, test,
 * and reason about is worth more here than one that handles every phrasing —
 * anything this cannot resolve becomes a single clarifying question (FR-001
 * acceptance scenario 4), never a guess.
 *
 * All dates are calendar dates in ISO `YYYY-MM-DD`, computed in UTC so a
 * request made late in the evening does not shift by a day between here and
 * HR Core, which also treats them as UTC midnight.
 */

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ParsedBookingRequest {
  /** Whether the message is asking to book/request/take leave at all. */
  isBookingRequest: boolean;
  /** Resolved calendar range, or null when the message named no usable dates. */
  range: DateRange | null;
  /** The user's own words for the leave type, if any ("sick", "annual", ...). */
  leaveTypeHint: string | null;
  /** True when illness vocabulary was present — drives the compassionate path later (US4). */
  mentionsIllness: boolean;
}

const BOOKING_VERBS = [
  'book',
  'request',
  'apply for',
  'submit',
  'take',
  'schedule',
  'put in',
  'log',
  'register',
  'need',
  'want',
  "i'd like",
  'i would like',
  'can i have',
  'can i get',
  'give me',
];

const LEAVE_NOUNS = [
  'leave',
  'day off',
  'days off',
  'time off',
  'off work',
  'vacation',
  'holiday',
  'holidays',
  'pto',
  'absence',
  'congé',
  'conge',
];

/** Phrasings that are questions ABOUT leave, not requests to take it. */
const READ_ONLY_SIGNALS = [
  'balance',
  'how many',
  'how much',
  'remaining',
  'left',
  'history',
  'status of',
  'when is',
  'what is',
  "what's",
  'policy',
  'entitled',
  'entitlement',
  'calendar',
  'who is off',
  "who's off",
  'coverage',
  'cancel',
  'withdraw',
];

const ILLNESS_TERMS = ['sick', 'ill', 'unwell', 'fever', 'flu', 'not feeling well', "don't feel well", 'malade'];

const LEAVE_TYPE_HINTS: Array<{ hint: string; terms: string[] }> = [
  { hint: 'sick', terms: ['sick', 'ill', 'unwell', 'fever', 'flu', 'not feeling well', 'medical', 'malade', 'maladie'] },
  { hint: 'parental', terms: ['parental', 'maternity', 'paternity', 'newborn', 'baby', 'maternité', 'paternité'] },
  { hint: 'bereavement', terms: ['bereavement', 'funeral', 'compassionate', 'passed away'] },
  { hint: 'unpaid', terms: ['unpaid'] },
  { hint: 'study', terms: ['study', 'exam', 'training'] },
  { hint: 'annual', terms: ['annual', 'vacation', 'holiday', 'pto', 'paid leave', 'congé payé', 'conge paye'] },
];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function parseBookingRequest(message: string, today: Date = new Date()): ParsedBookingRequest {
  const lower = message.toLowerCase().replace(/\s+/g, ' ').trim();
  const mentionsIllness = ILLNESS_TERMS.some((term) => lower.includes(term));

  const hasLeaveNoun = LEAVE_NOUNS.some((noun) => lower.includes(noun));
  const hasBookingVerb = BOOKING_VERBS.some((verb) => lower.includes(verb));
  const readOnly = READ_ONLY_SIGNALS.some((signal) => lower.includes(signal));

  /**
   * "I'm sick today" carries no booking verb and no leave noun but is the
   * canonical sick-leave phrasing (spec 017 US4). Illness alone is treated as
   * a booking request; the compassionate specifics (default to today, ask no
   * diagnostic questions) are applied by the caller.
   */
  const isBookingRequest = !readOnly && ((hasLeaveNoun && hasBookingVerb) || mentionsIllness);

  return {
    isBookingRequest,
    range: isBookingRequest ? extractDateRange(lower, today) : null,
    leaveTypeHint: detectLeaveTypeHint(lower),
    mentionsIllness,
  };
}

function detectLeaveTypeHint(lower: string): string | null {
  for (const { hint, terms } of LEAVE_TYPE_HINTS) {
    if (terms.some((term) => lower.includes(term))) return hint;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

function extractDateRange(lower: string, today: Date): DateRange | null {
  const base = utcMidnight(today);

  const explicit = extractExplicitDates(lower, base);
  if (explicit.length >= 2) {
    const first = explicit[0]!;
    const second = explicit[1]!;
    const [a, b] = first.getTime() <= second.getTime() ? [first, second] : [second, first];
    return { startDate: iso(a), endDate: iso(b) };
  }

  const durationDays = extractDurationDays(lower);

  if (explicit.length === 1) {
    const start = explicit[0]!;
    return { startDate: iso(start), endDate: iso(addBusinessDays(start, durationDays ?? 1)) };
  }

  const relativeStart = extractRelativeStart(lower, base);
  if (relativeStart) {
    return { startDate: iso(relativeStart), endDate: iso(addBusinessDays(relativeStart, durationDays ?? 1)) };
  }

  if (/\b(today|this morning|this afternoon)\b/.test(lower)) {
    return { startDate: iso(base), endDate: iso(addBusinessDays(base, durationDays ?? 1)) };
  }

  if (/\btomorrow\b/.test(lower)) {
    const start = addDays(base, 1);
    return { startDate: iso(start), endDate: iso(addBusinessDays(start, durationDays ?? 1)) };
  }

  const weekStart = extractNamedWeek(lower, base);
  if (weekStart) {
    // "next week" with no day named: Monday to Friday, or N business days from Monday.
    return { startDate: iso(weekStart), endDate: iso(addBusinessDays(weekStart, durationDays ?? 5)) };
  }

  return null;
}

/** ISO dates, "12 June", "June 12", "12/06", "12th of June". */
function extractExplicitDates(lower: string, base: Date): Date[] {
  const found: Date[] = [];

  for (const match of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const date = makeUtc(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date) found.push(date);
  }

  for (const match of lower.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([a-z]+)(?:\s+(\d{4}))?\b/g)) {
    const month = monthIndex(match[2]!);
    if (month === null) continue;
    const date = resolveDayMonth(Number(match[1]), month, match[3] ? Number(match[3]) : null, base);
    if (date) found.push(date);
  }

  for (const match of lower.matchAll(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g)) {
    const month = monthIndex(match[1]!);
    if (month === null) continue;
    const date = resolveDayMonth(Number(match[2]), month, match[3] ? Number(match[3]) : null, base);
    if (date) found.push(date);
  }

  // DD/MM or DD/MM/YYYY — day-first, matching the project's locale conventions.
  for (const match of lower.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const year = match[3] ? normalizeYear(Number(match[3])) : null;
    const date = resolveDayMonth(Number(match[1]), Number(match[2]) - 1, year, base);
    if (date) found.push(date);
  }

  // De-duplicate while preserving order.
  const seen = new Set<string>();
  return found.filter((date) => {
    const key = iso(date);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * "next monday", "this friday", "on tuesday" → the next occurrence strictly after
 * today. "next" and "this" are deliberately treated the same: English usage of
 * "next Friday" is genuinely ambiguous, and the resolved dates are shown on the
 * card before anything is booked — the user, not a heuristic, settles it.
 */
function extractRelativeStart(lower: string, base: Date): Date | null {
  const match = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!match) return null;
  const target = WEEKDAYS.indexOf(match[1]!);
  let delta = (target - base.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(base, delta);
}

/** "next week" → the coming Monday; "this week" → today (or Monday if weekend). */
function extractNamedWeek(lower: string, base: Date): Date | null {
  if (/\bnext week\b/.test(lower)) {
    const toMonday = (8 - base.getUTCDay()) % 7 || 7;
    return addDays(base, toMonday);
  }
  if (/\bthis week\b/.test(lower)) {
    const day = base.getUTCDay();
    if (day === 0) return addDays(base, 1);
    if (day === 6) return addDays(base, 2);
    return base;
  }
  return null;
}

/** "2 days", "three days", "a week", "2 weeks". Returns business days. */
function extractDurationDays(lower: string): number | null {
  const words: Record<string, number> = {
    a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const match = lower.match(/\b(\d{1,2}|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks)\b/);
  if (!match) return null;
  const count = /^\d+$/.test(match[1]!) ? Number(match[1]) : words[match[1]!] ?? null;
  if (count === null || count <= 0) return null;
  return match[2]!.startsWith('week') ? count * 5 : count;
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function makeUtc(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

/** A day/month with no year resolves to the next occurrence on or after today. */
function resolveDayMonth(day: number, month: number, year: number | null, base: Date): Date | null {
  if (month < 0 || month > 11) return null;
  if (year !== null) return makeUtc(year, month, day);
  const thisYear = makeUtc(base.getUTCFullYear(), month, day);
  if (thisYear && thisYear.getTime() >= base.getTime()) return thisYear;
  return makeUtc(base.getUTCFullYear() + 1, month, day);
}

function normalizeYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}

function monthIndex(word: string): number | null {
  const index = MONTHS.findIndex((month) => month === word || month.slice(0, 3) === word);
  return index === -1 ? null : index;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * The end date of a span of N business days starting at `start`, skipping
 * weekends only. Holidays are NOT considered here — the advisory count on the
 * card is computed separately with the business unit's holiday calendar, and
 * HR Core recomputes totalDays authoritatively at creation (research.md R4).
 */
function addBusinessDays(start: Date, businessDays: number): Date {
  let cursor = start;
  let remaining = Math.max(businessDays, 1);
  while (isWeekend(cursor)) cursor = addDays(cursor, 1);
  remaining -= 1;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (!isWeekend(cursor)) remaining -= 1;
  }
  return cursor;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Advisory business-day count for the card (spec 017 T028): weekdays in the
 * inclusive range minus any listed holiday dates. Deliberately NOT a port of
 * HR Core's countBusinessDays — no half-day handling, no recurrence expansion
 * beyond what the holiday list already resolved — because the two are never
 * compared (research.md R4) and a second copy of that rule would drift.
 */
export function countAdvisoryBusinessDays(range: DateRange, holidayIsoDates: ReadonlySet<string>): number {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  let count = 0;
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    if (isWeekend(cursor)) continue;
    if (holidayIsoDates.has(iso(cursor))) continue;
    count += 1;
  }
  return count;
}
