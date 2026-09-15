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
  getEmployees,
  getOkrCycles,
  getObjectives,
  type CreateObjectivePayload,
  type EmployeeProfile,
  type ObjectiveResponse,
} from '@/lib/api/hr-core';
import { useAuth } from '@/components/providers/auth-provider';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';
import { scoreObjective } from '@/lib/okr-quality';
import { OkrQualityPanel } from './okr-quality-panel';

function formatEmployeeName(employee: EmployeeProfile): string {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  const role = employee.position?.title;
  const department = employee.department?.name;
  return [name, role, department].filter(Boolean).join(' - ');
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
  initialParentObjectiveId?: string;
  initialOwnerId?: string;
}

export function ObjectiveForm({ open, onClose, cycleId, initialLevel, initialParentObjectiveId, initialOwnerId }: ObjectiveFormProps) {
  const { user } = useAuth();
  const [level, setLevel] = useState<ObjectiveLevel>(initialLevel);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const parentLevel: ObjectiveLevel = level === 'DEPARTMENT' ? 'COMPANY' : 'DEPARTMENT';
  const isManager = user?.roles.includes('MANAGER') ?? false;
  const isHrAdmin = user?.roles.includes('HR_ADMIN') ?? false;
  const levelOptions: ObjectiveLevel[] = isHrAdmin
    ? ['COMPANY', 'DEPARTMENT', 'EMPLOYEE']
    : isManager
      ? ['DEPARTMENT', 'EMPLOYEE']
      : ['EMPLOYEE'];

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      parentObjectiveId: initialParentObjectiveId,
      ownerId: initialOwnerId,
    },
  });
  const watchedOwner = watch('ownerId');

  const { data: cycleData } = useQuery({
    queryKey: ['okr-cycles', 'objective-form-parent-cycles'],
    queryFn: () => getOkrCycles({ limit: 100 }),
    enabled: level !== 'COMPANY',
  });

  const currentCycle = cycleData?.items.find((cycle) => cycle.id === cycleId);
  const parentCycleId = level === 'DEPARTMENT' ? currentCycle?.parentCycleId : null;

  const { data: employeePage, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', 'objective-form-owners', user?.departmentId, isHrAdmin],
    queryFn: () =>
      getEmployees({
        limit: 100,
        status: 'ACTIVE',
        ...(isManager && !isHrAdmin && user?.departmentId ? { departmentId: user.departmentId } : {}),
      }),
    enabled: level === 'EMPLOYEE' && (isHrAdmin || isManager),
  });

  const employeeCandidates = employeePage?.data ?? [];
  const selectedEmployee = employeeCandidates.find((employee) => employee.id === watchedOwner) ?? null;

  const { data: parentCandidates = [], isLoading: parentCandidatesLoading } = useQuery({
    queryKey: ['objectives', 'parent-candidates', cycleId, parentCycleId, parentLevel, selectedEmployee?.departmentId],
    queryFn: async (): Promise<ObjectiveResponse[]> => {
      const candidateCycleIds = parentCycleId ? [cycleId, parentCycleId] : [cycleId];
      const pages = await Promise.all(
        candidateCycleIds.map((candidateCycleId) =>
          getObjectives({
            cycleId: candidateCycleId,
            level: parentLevel,
            status: 'ACTIVE',
            limit: 100,
          }),
        ),
      );

      const objectives = Array.from(
        new Map(pages.flatMap((page) => page.items).map((objective) => [objective.id, objective])).values(),
      );

      if (level === 'EMPLOYEE' && selectedEmployee?.departmentId) {
        return objectives.filter((objective) => objective.departmentId === selectedEmployee.departmentId);
      }

      return objectives;
    },
    enabled: level !== 'COMPANY',
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateObjectivePayload = {
        title: values.title,
        description: values.description,
        level,
        cycleId,
        parentObjectiveId: values.parentObjectiveId,
        departmentId: level === 'DEPARTMENT' ? values.departmentId ?? user?.departmentId ?? undefined : values.departmentId,
        ownerId: level === 'EMPLOYEE' ? values.ownerId ?? user?.employeeId ?? undefined : values.ownerId,
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
      setFormError(getGatewayErrorMessage(err, 'Failed to create objective. Please try again.'));
    },
  });

  const watchedParent = watch('parentObjectiveId');
  const watchedTitle = watch('title');
  const watchedDescription = watch('description');

  const shouldShowPanel = (watchedTitle ?? '').trim().length >= 3;

  const qualityReport = scoreObjective({
    title: watchedTitle,
    description: watchedDescription,
    level,
    parentObjectiveId: watchedParent,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Objective</DialogTitle>
          <p className="text-xs text-muted-foreground">
            An Objective is a qualitative goal — inspiring, not measured. You'll add measurable Key Results to it next.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => {
            if (level !== 'COMPANY' && !v.parentObjectiveId) {
              setFormError('Please select a parent objective before creating.');
              return;
            }
            if (level === 'EMPLOYEE' && (isHrAdmin || isManager) && !v.ownerId) {
              setFormError('Please select an owner for this employee objective.');
              return;
            }
            mutation.mutate(v);
          })} className="space-y-4">
          <div className="space-y-1">
            <Label>Level</Label>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel(v as ObjectiveLevel);
                setValue('parentObjectiveId', undefined);
                setValue('departmentId', undefined);
                setValue('ownerId', undefined);
                setFormError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levelOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'COMPANY' ? 'Company' : option === 'DEPARTMENT' ? 'Department' : 'Employee'}
                  </SelectItem>
                ))}
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

          {shouldShowPanel && <OkrQualityPanel report={qualityReport} />}

          {level === 'EMPLOYEE' && (isHrAdmin || isManager) && (
            <div className="space-y-1">
              <Label>Owner *</Label>
              <Select
                value={watchedOwner}
                onValueChange={(v) => {
                  setValue('ownerId', v, { shouldValidate: true });
                  setFormError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={employeesLoading ? 'Loading employees...' : 'Select employee...'} />
                </SelectTrigger>
                <SelectContent>
                  {employeesLoading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading employees...</div>
                  ) : employeeCandidates.length > 0 ? (
                    employeeCandidates.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {formatEmployeeName(employee)}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No active employees available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {level === 'EMPLOYEE' && !isHrAdmin && !isManager && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This objective will be assigned to you.
            </div>
          )}

          {level !== 'COMPANY' && (
            <div className="space-y-1">
              <Label>Parent Objective *</Label>
              <Select
                value={watchedParent}
                onValueChange={(v) => { setValue('parentObjectiveId', v, { shouldValidate: true }); setFormError(null); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent…" />
                </SelectTrigger>
                <SelectContent>
                  {parentCandidatesLoading ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading parent objectives...</div>
                  ) : parentCandidates.length > 0 ? (
                    parentCandidates.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No active {parentLevel.toLowerCase()} parent objectives available
                      {level === 'EMPLOYEE' ? '. Activate a department objective first.' : ''}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {level === 'DEPARTMENT' && isManager && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This objective will be linked to your department.
            </div>
          )}

          {level === 'DEPARTMENT' && !isManager && (
            <div className="space-y-1">
              <Label htmlFor="departmentId">Department ID</Label>
              <Input id="departmentId" {...register('departmentId')} placeholder="dept-uuid…" />
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
