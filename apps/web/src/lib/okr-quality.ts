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

/**
 * WHY keys and not sentences: this module runs outside React and is pure —
 * it has no `t`. Emitting locale keys (resolved by OkrQualityPanel) keeps the
 * scoring rules here and the wording in `okr.json`, so the coach speaks the
 * user's language without this file importing i18next.
 */
export type QualityLabelKey =
  | 'criterion_specific'
  | 'criterion_measurable'
  | 'criterion_tiedToImpact'
  | 'criterion_tiedToParent'
  | 'criterion_timeBound';

export type QualityHintKey =
  | 'hint_tooShort'
  | 'hint_vagueStem'
  | 'hint_activityPrefix'
  | 'hint_tieToParent'
  | 'hint_pickMetric'
  | 'hint_numericTarget'
  | 'hint_booleanTarget'
  | 'hint_targetPositive'
  | 'hint_addUnit'
  | 'hint_addDueDate'
  | 'hint_dueBeforeCycleEnd';

/**
 * WHY a type alias and not an interface: i18next's `t()` options require an
 * implicit index signature, which TypeScript gives type aliases but never
 * interfaces — an interface here fails to typecheck at the call site.
 */
export type QualityHintValues = {
  /** Cycle end date, ISO yyyy-mm-dd — used by `hint_dueBeforeCycleEnd`. */
  readonly date?: string;
};

export interface QualityHint {
  key: QualityHintKey;
  values?: QualityHintValues;
}

export interface CriterionResult {
  criterion: OkrCriterion;
  labelKey: QualityLabelKey;
  pass: boolean;
  hint: QualityHint | null;
  autoPass?: boolean;
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

function specificHint(reason: 'tooShort' | 'vagueStem' | 'activityPrefix' | 'ok'): QualityHint | null {
  switch (reason) {
    case 'tooShort':
      return { key: 'hint_tooShort' };
    case 'vagueStem':
      return { key: 'hint_vagueStem' };
    case 'activityPrefix':
      return { key: 'hint_activityPrefix' };
    default:
      return null;
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
      labelKey: 'criterion_specific',
      pass: specificCheck.pass,
      hint: specificCheck.pass ? null : specificHint(specificCheck.reason),
    },
    {
      criterion: 'tiedToImpact',
      labelKey: 'criterion_tiedToImpact',
      pass: tiedPass,
      hint: tiedPass ? null : { key: 'hint_tieToParent' },
    },
    {
      criterion: 'timeBound',
      labelKey: 'criterion_timeBound',
      pass: true,
      hint: null,
      autoPass: true,
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

  const measurableHint: QualityHint | null = !values.metricType
    ? { key: 'hint_pickMetric' }
    : isNaN(target)
      ? { key: 'hint_numericTarget' }
      : values.metricType === 'BOOLEAN' && target !== 1
        ? { key: 'hint_booleanTarget' }
        : target <= 0
          ? { key: 'hint_targetPositive' }
          : !(values.unit ?? '').trim()
            ? { key: 'hint_addUnit' }
            : null;

  const dueDate = values.dueDate ? new Date(values.dueDate) : null;
  const cycleEnd = cycle?.endDate ? new Date(cycle.endDate) : null;
  const timeBoundPass = Boolean(dueDate) && (!cycleEnd || dueDate! <= cycleEnd);
  const timeBoundHint: QualityHint | null = !dueDate
    ? { key: 'hint_addDueDate' }
    : cycleEnd && dueDate > cycleEnd
      ? { key: 'hint_dueBeforeCycleEnd', values: { date: cycleEnd.toISOString().slice(0, 10) } }
      : null;

  const results: CriterionResult[] = [
    {
      criterion: 'specific',
      labelKey: 'criterion_specific',
      pass: specificCheck.pass,
      hint: specificCheck.pass ? null : specificHint(specificCheck.reason),
    },
    {
      criterion: 'measurable',
      labelKey: 'criterion_measurable',
      pass: measurablePass,
      hint: measurablePass ? null : measurableHint,
    },
    {
      criterion: 'tiedToImpact',
      labelKey: 'criterion_tiedToParent',
      pass: true,
      hint: null,
      autoPass: true,
    },
    {
      criterion: 'timeBound',
      labelKey: 'criterion_timeBound',
      pass: timeBoundPass,
      hint: timeBoundHint,
    },
  ];

  const score = results.filter((r) => r.pass).length;
  return { score, total: results.length, results };
}
