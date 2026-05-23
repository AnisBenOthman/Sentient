import { useState } from 'react';
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

const schema = z.object({
  value: z.string().min(1, 'Value is required'),
  comment: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CheckInFormProps {
  open: boolean;
  onClose: () => void;
  kr: KeyResultResponse;
}

export function CheckInForm({ open, onClose, kr }: CheckInFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
      setFormError(getGatewayErrorMessage(err, 'Failed to submit check-in. Please try again.'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Check-in</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{kr.title}</p>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="value">
              Value *{kr.unit ? ` (${kr.unit})` : ''}
              {kr.metricType === 'BOOLEAN' && ' — 0 or 1'}
            </Label>
            <Input id="value" {...register('value')} type="number" step="any" />
            {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            <p className="text-xs text-muted-foreground">
              Preview score: {previewScore(kr, watchedValue)}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="comment">Comment (optional)</Label>
            <Textarea id="comment" {...register('comment')} rows={3} />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
