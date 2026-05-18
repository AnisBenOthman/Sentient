import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ObjectiveLevel,
  createObjective,
  getObjectives,
  type CreateObjectivePayload,
} from '@/lib/api/hr-core';

const ERROR_MAP: Record<string, string> = {
  CycleNotActive: 'Cannot create an OKR in a closed or draft cycle.',
  ParentNotFound: 'Parent OKR no longer exists.',
  ParentWrongLevel: 'Parent OKR is not at the expected level.',
  ParentNotActive: 'Cannot align to a closed or cancelled parent OKR.',
  CrossDepartmentAlignment: 'Employee OKRs must align to your own department\'s OKRs.',
  LevelMismatch: 'Invalid OKR level configuration.',
};

function extractApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string } } }).response;
    return r?.data?.message ?? 'Unknown error';
  }
  return String(err);
}

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  parentObjectiveId: z.string().uuid().optional(),
  departmentId: z.string().optional(),
  ownerId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ObjectiveFormProps {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  initialLevel: ObjectiveLevel;
}

export function ObjectiveForm({ open, onClose, cycleId, initialLevel }: ObjectiveFormProps) {
  const [level, setLevel] = useState<ObjectiveLevel>(initialLevel);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: parentCandidates } = useQuery({
    queryKey: ['objectives', cycleId, level === 'DEPARTMENT' ? 'COMPANY' : 'DEPARTMENT'],
    queryFn: () =>
      getObjectives({
        cycleId,
        level: level === 'DEPARTMENT' ? 'COMPANY' : 'DEPARTMENT',
        status: 'ACTIVE',
      }),
    enabled: level !== 'COMPANY',
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateObjectivePayload = {
        title: values.title,
        description: values.description,
        level,
        cycleId,
        parentObjectiveId: values.parentObjectiveId,
        departmentId: values.departmentId,
        ownerId: values.ownerId,
      };
      return createObjective(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      reset();
      setFormError(null);
      onClose();
    },
    onError: (err: unknown) => {
      const code = extractApiError(err);
      setFormError(ERROR_MAP[code] ?? 'Failed to create objective. Please try again.');
    },
  });

  const watchedParent = watch('parentObjectiveId');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Objective</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as ObjectiveLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Company</SelectItem>
                <SelectItem value="DEPARTMENT">Department</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register('title')} placeholder="OKR title…" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} rows={3} />
          </div>

          {level !== 'COMPANY' && (
            <div className="space-y-1">
              <Label>Parent Objective *</Label>
              <Select value={watchedParent} onValueChange={(v) => setValue('parentObjectiveId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent…" />
                </SelectTrigger>
                <SelectContent>
                  {parentCandidates?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {level === 'DEPARTMENT' && (
            <div className="space-y-1">
              <Label htmlFor="departmentId">Department ID</Label>
              <Input id="departmentId" {...register('departmentId')} placeholder="dept-uuid…" />
            </div>
          )}

          {level === 'EMPLOYEE' && (
            <div className="space-y-1">
              <Label htmlFor="ownerId">Employee ID (Owner)</Label>
              <Input id="ownerId" {...register('ownerId')} placeholder="employee-uuid…" />
            </div>
          )}

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
