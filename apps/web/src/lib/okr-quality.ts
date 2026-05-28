import type {
  CreateKeyResultPayload,
  CreateObjectivePayload,
  KeyResultMetricType,
  ObjectiveLevel,
} from '@/lib/api/hr-core';

export type OkrCriterion =
  | 'specific'
  | 'measurable'
  | 'tiedToImpact'
  | 'timeBound';

export interface CriterionResult {
  criterion: OkrCriterion;
  label: string;
  pass: boolean;
  hint: string;
}

export interface QualityReport {
  score: number;
  total: number;
  results: CriterionResult[];
}

const VAGUE_STEM = /^\s*(improve|enhance|better|more|increase|reduce|grow|drive|boost|support|enable|ensure)\b/i;
const HAS_NUMBER = /\d/;
const ACTIVITY_PREFIX = /^\s*(organize|launch|host|run|conduct|hold|schedule|plan|execute|deliver|perform|post|send)\b/i;

const MIN_TITLE_LEN = 12;

function isSpecificTitle(title: string | undefined): { pass: boolean; reason: 'tooShort' | 'vagueStem' | 'activityPrefix' | 'ok' } {
  const value = (title ?? '').trim();
  if (value.length < MIN_TITLE_LEN) return { pass: false, reason: 'tooShort' };
  if (ACTIVITY_PREFIX.test(value)) return { pass: false, reason: 'activityPrefix' };
  if (VAGUE_STEM.test(value) && !HAS_NUMBER.test(value)) return { pass: false, reason: 'vagueStem' };
  return { pass: true, reason: 'ok' };
}

function specificHint(reason: 'tooShort' | 'vagueStem' | 'activityPrefix' | 'ok'): string {
  switch (reason) {
    case 'tooShort':
      return 'Title is too short. Name the outcome precisely (e.g. "Increase eNPS from 12 to 20").';
    case 'vagueStem':
      return 'Vague phrasing — add a benchmark like "from X to Y" so the outcome is concrete.';
    case 'activityPrefix':
      return 'This reads like an activity, not an outcome. State the result, not the action ("Increase satisfaction by 15%" instead of "Organize 3 workshops").';
    default:
      return '';
  }
}

export function scoreObjective(
  values: Pick<CreateObjectivePayload, 'title' | 'description' | 'level' | 'parentObjectiveId'> & {
    level?: ObjectiveLevel;
  },
): QualityReport {
  const specificCheck = isSpecificTitle(values.title);

  const tiedPass =
    values.level === 'COMPANY' ? true : Boolean(values.parentObjectiveId);

  const results: CriterionResult[] = [
    {
      criterion: 'specific',
      label: 'Specific & outcome-focused',
      pass: specificCheck.pass,
      hint: specificCheck.pass ? '' : specificHint(specificCheck.reason),
    },
    {
      criterion: 'tiedToImpact',
      label: 'Tied to business impact',
      pass: tiedPass,
      hint: tiedPass
        ? ''
        : 'Link this objective to a parent so it ladders up to a higher-level goal.',
    },
    {
      criterion: 'timeBound',
      label: 'Time-bound',
      pass: true,
      hint: '',
    },
  ];

  const score = results.filter((r) => r.pass).length;
  return { score, total: results.length, results };
}

interface KrInput {
  title?: string;
  metricType?: KeyResultMetricType;
  targetValue?: string;
  unit?: string;
  dueDate?: string;
}

export function scoreKeyResult(
  values: KrInput,
  cycle?: { endDate?: string | null },
): QualityReport {
  const specificCheck = isSpecificTitle(values.title);

  const target = values.targetValue ? Number(values.targetValue) : NaN;
  const measurablePass =
    Boolean(values.metricType) &&
    !isNaN(target) &&
    (values.metricType === 'BOOLEAN' ? target === 1 : target > 0) &&
    (values.metricType === 'BOOLEAN' || Boolean((values.unit ?? '').trim()));

  const measurableHint = !values.metricType
    ? 'Pick a metric type (Percentage, Number, Currency, or Boolean).'
    : isNaN(target)
      ? 'Set a numeric target value — without a number this KR can\'t be scored.'
      : values.metricType === 'BOOLEAN' && target !== 1
        ? 'Boolean KRs use target 1 (done) — pair with a clear "done" definition.'
        : target <= 0
          ? 'Target must be greater than zero.'
          : !(values.unit ?? '').trim()
            ? 'Add a unit (e.g. "days", "%", "USD", "score") so the number has meaning.'
            : '';

  const dueDate = values.dueDate ? new Date(values.dueDate) : null;
  const cycleEnd = cycle?.endDate ? new Date(cycle.endDate) : null;
  const timeBoundPass = Boolean(dueDate) && (!cycleEnd || dueDate! <= cycleEnd);
  const timeBoundHint = !dueDate
    ? 'Add a due date so progress is time-boxed.'
    : cycleEnd && dueDate > cycleEnd
      ? `Due date must be on or before the cycle end (${cycleEnd.toISOString().slice(0, 10)}).`
      : '';

  const results: CriterionResult[] = [
    {
      criterion: 'specific',
      label: 'Specific & outcome-focused',
      pass: specificCheck.pass,
      hint: specificCheck.pass ? '' : specificHint(specificCheck.reason),
    },
    {
      criterion: 'measurable',
      label: 'Measurable with a target',
      pass: measurablePass,
      hint: measurablePass ? '' : measurableHint,
    },
    {
      criterion: 'tiedToImpact',
      label: 'Tied to a parent objective',
      pass: true,
      hint: '',
    },
    {
      criterion: 'timeBound',
      label: 'Time-bound',
      pass: timeBoundPass,
      hint: timeBoundHint,
    },
  ];

  const score = results.filter((r) => r.pass).length;
  return { score, total: results.length, results };
}
