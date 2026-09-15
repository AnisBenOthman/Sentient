import { countAdvisoryBusinessDays, parseBookingRequest, parseDateRange, removeExplicitDates } from './leave-booking-request.parser';

// A fixed Tuesday so weekday arithmetic is deterministic: 2026-06-09 is a Tuesday.
const TUESDAY = new Date('2026-06-09T15:30:00.000Z');

describe('parseBookingRequest — intent detection (T022)', () => {
  it.each([
    'I want to book 2 days of annual leave next week',
    'Can I take Friday off?',
    'Please request leave from 12 June to 14 June',
    'I need a day off tomorrow',
    "I'd like to apply for vacation on 2026-07-01",
    "I'm sick today",
    'Not feeling well, staying home',
    // Live Slack transcript 2026-09-15: no LEAVE_NOUNS entry, only a strong verb + duration.
    'i want to book one day next week on 20 september',
    'take 2 days next Monday',
    'I want Friday off',
  ])('treats "%s" as a booking request', (message) => {
    expect(parseBookingRequest(message, TUESDAY).isBookingRequest).toBe(true);
  });

  it.each([
    'What is my leave balance?',
    'How many days do I have left?',
    'Show my leave history',
    "What's the sick leave policy?",
    'When is the next public holiday?',
    'Who is off next week?',
    'Cancel my leave request',
    // Soft verb + bare duration is not a booking; a duration in the past is history.
    'I need two days to finish the report',
    'I booked 2 days ago, is it approved?',
    'paid leave, 20 september',
  ])('does NOT treat "%s" as a booking request', (message) => {
    expect(parseBookingRequest(message, TUESDAY).isBookingRequest).toBe(false);
  });

  it('extracts a leave-type hint from the phrasing', () => {
    expect(parseBookingRequest('book sick leave tomorrow', TUESDAY).leaveTypeHint).toBe('sick');
    expect(parseBookingRequest('take some vacation next week', TUESDAY).leaveTypeHint).toBe('annual');
    expect(parseBookingRequest('request paternity leave from 1 July', TUESDAY).leaveTypeHint).toBe('parental');
    expect(parseBookingRequest('book 2 days off next week', TUESDAY).leaveTypeHint).toBeNull();
  });
});

describe('parseBookingRequest — date extraction (T022)', () => {
  it('reads an explicit ISO range', () => {
    const parsed = parseBookingRequest('book leave from 2026-07-01 to 2026-07-03', TUESDAY);
    expect(parsed.range).toEqual({ startDate: '2026-07-01', endDate: '2026-07-03' });
  });

  it('reads "12 June to 14 June" and orders the dates', () => {
    const parsed = parseBookingRequest('request leave 14 June to 12 June', TUESDAY);
    expect(parsed.range).toEqual({ startDate: '2026-06-12', endDate: '2026-06-14' });
  });

  it('reads a single date plus a duration in business days', () => {
    // Friday 12 June + 3 business days = Fri, Mon, Tue -> ends Tuesday 16 June.
    const parsed = parseBookingRequest('book 3 days of leave from 12 June', TUESDAY);
    expect(parsed.range).toEqual({ startDate: '2026-06-12', endDate: '2026-06-16' });
  });

  it('resolves "tomorrow" to a single day', () => {
    const parsed = parseBookingRequest('I need a day off tomorrow', TUESDAY);
    expect(parsed.range).toEqual({ startDate: '2026-06-10', endDate: '2026-06-10' });
  });

  it('resolves "today" for illness with no other date', () => {
    const parsed = parseBookingRequest("I'm sick today", TUESDAY);
    expect(parsed.range).toEqual({ startDate: '2026-06-09', endDate: '2026-06-09' });
    expect(parsed.mentionsIllness).toBe(true);
  });

  it('resolves a weekday name to the next occurrence strictly after today', () => {
    // Said on Tuesday 9 June: "friday" -> 12 June; "tuesday" -> 16 June, never today.
    expect(parseBookingRequest('take friday off', TUESDAY).range?.startDate).toBe('2026-06-12');
    expect(parseBookingRequest('book leave on tuesday', TUESDAY).range?.startDate).toBe('2026-06-16');
  });

  it('resolves "next week" to Monday-Friday by default and to N days when stated', () => {
    expect(parseBookingRequest('book leave next week', TUESDAY).range).toEqual({ startDate: '2026-06-15', endDate: '2026-06-19' });
    expect(parseBookingRequest('book 2 days off next week', TUESDAY).range).toEqual({ startDate: '2026-06-15', endDate: '2026-06-16' });
  });

  it('returns no range when the message names no usable dates', () => {
    expect(parseBookingRequest('I want to book some annual leave', TUESDAY).range).toBeNull();
  });

  it('moves a lone weekend date to the following Monday, but leaves an explicit two-date range alone', () => {
    // 2026-06-13 is a Saturday.
    expect(parseBookingRequest('book one day on 13 June', TUESDAY).range).toEqual({ startDate: '2026-06-15', endDate: '2026-06-15' });
    expect(parseBookingRequest('book leave from 13 June to 14 June', TUESDAY).range).toEqual({ startDate: '2026-06-13', endDate: '2026-06-14' });
  });

  it('parseDateRange reads dates with no intent gate, for clarification replies', () => {
    expect(parseDateRange('20 september', TUESDAY)).toEqual({ startDate: '2026-09-21', endDate: '2026-09-21' });
    expect(parseDateRange('annual', TUESDAY)).toBeNull();
  });

  it('removeExplicitDates blanks dates but keeps durations and relative phrasing', () => {
    expect(removeExplicitDates('book 2 days of annual leave from 2020-01-06 to 2020-01-07')).toBe('book 2 days of annual leave from to');
    expect(removeExplicitDates('take 3 days from 12th of June, June 15 and 12/06/2026 next week')).toBe('take 3 days from , and next week');
    expect(removeExplicitDates('I need 12 days off')).toBe('I need 12 days off');
  });

  it('accepts day-first numeric dates', () => {
    expect(parseBookingRequest('book leave 03/07 to 05/07', TUESDAY).range).toEqual({ startDate: '2026-07-03', endDate: '2026-07-05' });
  });
});

describe('countAdvisoryBusinessDays (T028)', () => {
  it('counts weekdays only across a weekend', () => {
    // Thu 11 Jun .. Tue 16 Jun = Thu, Fri, Mon, Tue = 4
    expect(countAdvisoryBusinessDays({ startDate: '2026-06-11', endDate: '2026-06-16' }, new Set())).toBe(4);
  });

  it('subtracts listed holidays', () => {
    expect(countAdvisoryBusinessDays({ startDate: '2026-06-11', endDate: '2026-06-16' }, new Set(['2026-06-15']))).toBe(3);
  });

  it('returns 0 for a weekend-only range', () => {
    expect(countAdvisoryBusinessDays({ startDate: '2026-06-13', endDate: '2026-06-14' }, new Set())).toBe(0);
  });
});
