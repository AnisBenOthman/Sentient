import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createKeyResult,
  KeyResultMetricType,
  type CreateKeyResultPayload,
} from '@/lib/api/hr-core';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';
import { scoreKeyResult } from '@/lib/okr-quality';
import { OkrQualityPanel } from './okr-quality-panel';

const METRIC_TYPES: KeyResultMetricType[] = ['PERCENTAGE', 'NUMBER', 'CURRENCY', 'BOOLEAN'];

const METRIC_TYPE_LABEL: Record<KeyResultMetricType, string> = {
  PERCENTAGE: 'Percentage',
  NUMBER: 'Number',
  CURRENCY: 'Currency',
  BOOLEAN: 'Boolean (done / not done)',
};

const DEFAULT_UNIT: Record<KeyResultMetricType, string> = {
  PERCENTAGE: '%',
  NUMBER: '',
  CURRENCY: 'USD',
  BOOLEAN: 'done',
};

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  metricType: z.enum(['PERCENTAGE', 'NUMBER', 'CURRENCY', 'BOOLEAN']),
  targetValue: z.string().min(1, 'Target value is required'),
  unit: z.string().max(32).optional(),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface KeyResultFormProps {
  open: boolean;
  onClose: () => void;
  objectiveId: string;
  cycleEndDate?: string | null;
}

export function KeyResultForm({ open, onClose, objectiveId, cycleEndDate }: KeyResultFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { metricType: 'NUMBER' },
  });

  const watchedAll = watch();
  const watchedMetric = watchedAll.metricType;

  useEffect(() => {
    if (!watchedMetric) return;
    const currentUnit = (watchedAll.unit ?? '').trim();
    const defaults = Object.values(DEFAULT_UNIT);
    if (!currentUnit || defaults.includes(currentUnit)) {
      setValue('unit', DEFAULT_UNIT[watchedMetric], { shouldValidate: false });
    }
    if (watchedMetric === 'BOOLEAN') {
      setValue('targetValue', '1', { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedMetric]);

  const cycleEndIso = cycleEndDate ? cycleEndDate.slice(0, 10) : null;

  const shouldShowPanel = (watchedAll.title ?? '').trim().length >= 3;

  const qualityReport = scoreKeyResult(
    {
      title: watchedAll.title,
      metricType: watchedAll.metricType,
      targetValue: watchedAll.targetValue,
      unit: watchedAll.unit,
      dueDate: watchedAll.dueDate,
    },
    cycleEndIso ? { endDate: cycleEndIso } : undefined,
  );

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateKeyResultPayload = {
        objectiveId,
        title: values.title,
        metricType: values.metricType,
        targetValue: values.targetValue,
        unit: values.unit?.trim() || undefined,
        dueDate: values.dueDate || undefined,
      };
      return createKeyResult(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      queryClient.invalidateQueries({ queryKey: ['employee-okr-portfolio'] });
      reset();
      setFormError(null);
      onClose();
    },
    onError: (err: unknown) => {
      setFormError(getGatewayErrorMessage(err, 'Failed to create key result. Please try again.'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Key Result</DialogTitle>
          <p className="text-xs text-muted-foreground">
            A Key Result measures how you'll know the objective is achieved — use a number, percentage, or milestone.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="kr-title">Title *</Label>
            <Input
              id="kr-title"
              {...register('title')}
              placeholder='e.g. "Reduce time-to-hire from 45 to 30 days"'
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Metric Type *</Label>
              <Select
                value={watchedMetric}
                onValueChange={(v) => setValue('metricType', v as KeyResultMetricType, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_TYPES.map((mt) => (
                    <SelectItem key={mt} value={mt}>{METRIC_TYPE_LABEL[mt]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="kr-target">Target Value *</Label>
              <Input
                id="kr-target"
                {...register('targetValue')}
                type="number"
                step="any"
                disabled={watchedMetric === 'BOOLEAN'}
                placeholder={watchedMetric === 'PERCENTAGE' ? '100' : '30'}
              />
              {errors.targetValue && <p className="text-xs text-destructive">{errors.targetValue.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="kr-unit">Unit</Label>
              <Input
                id="kr-unit"
                {...register('unit')}
                placeholder={watchedMetric === 'NUMBER' ? 'days, hires, NPS…' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="kr-due">Due Date</Label>
              <Input
                id="kr-due"
                {...register('dueDate')}
                type="date"
                max={cycleEndIso ?? undefined}
              />
              {cycleEndIso && (
                <p className="text-[11px] text-muted-foreground">
                  Cycle ends {cycleEndIso}
                </p>
              )}
            </div>
          </div>

          {shouldShowPanel && <OkrQualityPanel report={qualityReport} />}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
