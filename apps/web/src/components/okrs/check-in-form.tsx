import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Textarea } from '@/components/ui/textarea';
import { KeyResultResponse, submitCheckIn } from '@/lib/api/hr-core';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';

function previewScore(kr: KeyResultResponse, value: string): string {
  const v = parseFloat(value);
  if (isNaN(v)) return '—';
  if (kr.metricType === 'BOOLEAN') return v >= 1 ? '100%' : '0%';
  const target = parseFloat(kr.targetValue);
  if (target <= 0) return '—';
  return `${Math.min(Math.round((v / target) * 100), 100)}%`;
}

function buildSchema(valueRequired: string) {
  return z.object({
    value: z.string().min(1, valueRequired),
    comment: z.string().max(2000).optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface CheckInFormProps {
  open: boolean;
  onClose: () => void;
  kr: KeyResultResponse;
}

export function CheckInForm({ open, onClose, kr }: CheckInFormProps) {
  const { t } = useTranslation(['okr', 'common']);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const schema = useMemo(() => buildSchema(t('checkInForm.valueRequired')), [t]);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedValue = watch('value', '');

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitCheckIn({ keyResultId: kr.id, value: values.value, comment: values.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins', kr.id] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      reset();
      setFormError(null);
      onClose();
    },
    onError: (err: unknown) => {
      setFormError(getGatewayErrorMessage(err, t('checkInForm.submitFailed')));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('checkInForm.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{kr.title}</p>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="value">
              {t('checkInForm.value')}{kr.unit ? ` (${kr.unit})` : ''}
              {kr.metricType === 'BOOLEAN' && t('checkInForm.booleanHint')}
            </Label>
            <Input id="value" {...register('value')} type="number" step="any" />
            {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            <p className="text-xs text-muted-foreground">
              {t('checkInForm.previewScore')} {previewScore(kr, watchedValue)}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="comment">{t('checkInForm.comment')}</Label>
            <Textarea id="comment" {...register('comment')} rows={3} />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common:cancel')}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('checkInForm.submitting') : t('checkInForm.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
