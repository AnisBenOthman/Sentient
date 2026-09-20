import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, ChevronDown, ChevronRight, Network, Plus, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  getOkrCycles,
  createOkrCycle,
  activateCycle,
  closeCycle,
  OkrCycleResponse,
  OkrCycleType,
  ObjectiveResponse,
  getObjectives,
  updateObjective,
} from '@/lib/api/hr-core';
import { ObjectiveForm } from '@/components/okrs/objective-form';
import { KeyResultForm } from '@/components/okrs/key-result-form';
import { CheckInReviewQueue } from '@/components/okrs/check-in-review-queue';
import { OkrApprovalQueue } from '@/components/okrs/okr-approval-queue';
import { useAuth } from '@/components/providers/auth-provider';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';


const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  DRAFT: 'secondary',
  CLOSED: 'outline',
};

function objectivesByParent(objectives: ObjectiveResponse[], parentId: string): ObjectiveResponse[] {
  return objectives.filter((objective) => objective.parentObjectiveId === parentId);
}

interface ObjectiveCascadeRow {
  objective: ObjectiveResponse;
  depth: 0 | 1 | 2;
  parentTitle: string | null;
}

function buildObjectiveCascadeRows(
  companyObjectives: ObjectiveResponse[],
  departmentObjectives: ObjectiveResponse[],
  employeeObjectives: ObjectiveResponse[],
  allObjectives: ObjectiveResponse[],
): ObjectiveCascadeRow[] {
  const rows: ObjectiveCascadeRow[] = [];
  const displayedIds = new Set<string>();

  for (const companyObjective of companyObjectives) {
    rows.push({ objective: companyObjective, depth: 0, parentTitle: null });
    displayedIds.add(companyObjective.id);

    for (const departmentObjective of objectivesByParent(departmentObjectives, companyObjective.id)) {
      rows.push({ objective: departmentObjective, depth: 1, parentTitle: companyObjective.title });
      displayedIds.add(departmentObjective.id);

      for (const employeeObjective of objectivesByParent(employeeObjectives, departmentObjective.id)) {
        rows.push({ objective: employeeObjective, depth: 2, parentTitle: departmentObjective.title });
        displayedIds.add(employeeObjective.id);
      }
    }
  }

  for (const objective of allObjectives) {
    if (!displayedIds.has(objective.id)) {
      rows.push({ objective, depth: objective.level === 'COMPANY' ? 0 : objective.level === 'DEPARTMENT' ? 1 : 2, parentTitle: null });
    }
  }

  return rows;
}

interface ObjectiveCascadeTreeProps {
  selectedCycle: OkrCycleResponse;
  companyObjectives: ObjectiveResponse[];
  departmentObjectives: ObjectiveResponse[];
  employeeObjectives: ObjectiveResponse[];
  collapsedObjectiveIds: Set<string>;
  isHrAdmin: boolean;
  isManager: boolean;
  activateObjectivePending: boolean;
  onToggleObjective: (objectiveId: string) => void;
  onAddDepartmentObjective: (parentObjectiveId: string) => void;
  onAddEmployeeObjective: (parentObjectiveId: string) => void;
  onActivateObjective: (objectiveId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function ObjectiveCascadeTree({
  selectedCycle,
  companyObjectives,
  departmentObjectives,
  employeeObjectives,
  collapsedObjectiveIds,
  isHrAdmin,
  isManager,
  activateObjectivePending,
  onToggleObjective,
  onAddDepartmentObjective,
  onAddEmployeeObjective,
  onActivateObjective,
  onExpandAll,
  onCollapseAll,
}: ObjectiveCascadeTreeProps) {
  const { t } = useTranslation('okr');
  if (companyObjectives.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
        {t('cascade.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Network className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {t('cascade.treeTitle')}
          <span className="text-xs font-normal text-muted-foreground">
            {t('cascade.treeHint')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8" onClick={onExpandAll}>
            {t('cascade.expandAll')}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onCollapseAll}>
            {t('cascade.collapseAll')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {companyObjectives.map((companyObjective) => {
          const linkedDepartments = objectivesByParent(departmentObjectives, companyObjective.id);
          const companyExpanded = !collapsedObjectiveIds.has(companyObjective.id);
          const canAddDepartment =
            selectedCycle.status === 'ACTIVE' &&
            companyObjective.status === 'ACTIVE' &&
            (isManager || isHrAdmin);

          return (
            <section
              key={companyObjective.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 dark:border-slate-800 dark:from-emerald-950/30 dark:via-slate-950 dark:to-sky-950/30">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => onToggleObjective(companyObjective.id)}
                  aria-expanded={companyExpanded}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300">
                    {companyExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {t('enums.objectiveLevel_COMPANY')}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[companyObjective.status] ?? 'outline'}>
                        {t(`enums.objectiveStatus_${companyObjective.status}` as 'enums.objectiveStatus_DRAFT', { defaultValue: companyObjective.status })}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('cascade.departmentChildren', { count: linkedDepartments.length })}
                      </span>
                    </span>
                    <span className="mt-2 block truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                      {companyObjective.title}
                    </span>
                  </span>
                </button>

                {canAddDepartment && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/80 dark:bg-slate-950/80"
                    onClick={() => onAddDepartmentObjective(companyObjective.id)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('cascade.addDepartmentObjective')}
                  </Button>
                )}
              </div>

              {companyExpanded && (
                <div className="space-y-3 p-4">
                  {linkedDepartments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
                      {t('cascade.noDepartmentObjectives')}
                    </div>
                  ) : (
                    linkedDepartments.map((departmentObjective) => {
                      const linkedEmployees = objectivesByParent(employeeObjectives, departmentObjective.id);
                      const departmentExpanded = !collapsedObjectiveIds.has(departmentObjective.id);
                      const canActivateDepartment =
                        departmentObjective.status === 'DRAFT' &&
                        ((isHrAdmin && departmentObjective.level === 'DEPARTMENT') || isManager);

                      return (
                        <div key={departmentObjective.id} className="relative pl-5">
                          <div className="absolute bottom-6 left-2 top-0 w-px bg-slate-200 dark:bg-slate-800" />
                          <div className="absolute left-2 top-6 h-px w-4 bg-slate-200 dark:bg-slate-800" />
                          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                onClick={() => onToggleObjective(departmentObjective.id)}
                                aria-expanded={departmentExpanded}
                              >
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700 dark:border-sky-900 dark:bg-slate-950 dark:text-sky-300">
                                  {departmentExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                                      <Building2 className="mr-1 h-3 w-3" />
                                      {t('enums.objectiveLevel_DEPARTMENT')}
                                    </Badge>
                                    <Badge variant={STATUS_VARIANT[departmentObjective.status] ?? 'outline'}>
                                      {t(`enums.objectiveStatus_${departmentObjective.status}` as 'enums.objectiveStatus_DRAFT', { defaultValue: departmentObjective.status })}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {t('cascade.employeeChildren', { count: linkedEmployees.length })}
                                    </span>
                                  </span>
                                  <span className="mt-2 block truncate text-sm font-medium">
                                    {departmentObjective.title}
                                  </span>
                                </span>
                              </button>

                              <div className="flex flex-wrap justify-end gap-2">
                                {canActivateDepartment && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onActivateObjective(departmentObjective.id)}
                                    disabled={activateObjectivePending}
                                  >
                                    {t('cascade.activate')}
                                  </Button>
                                )}
                                {departmentObjective.status === 'ACTIVE' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onAddEmployeeObjective(departmentObjective.id)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('cascade.addEmployeeObjective')}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {departmentExpanded && (
                              <div className="mt-3 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800">
                                {linkedEmployees.length === 0 ? (
                                  <p className="rounded-md bg-white px-3 py-2 text-sm text-muted-foreground dark:bg-slate-950">
                                    {t('cascade.noEmployeeObjectives')}
                                  </p>
                                ) : (
                                  linkedEmployees.map((employeeObjective) => {
                                    const canActivateEmployee =
                                      employeeObjective.status === 'DRAFT' &&
                                      (isHrAdmin || isManager);
                                    return (
                                      <div
                                        key={employeeObjective.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                                      >
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Users className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                                          <span className="truncate text-sm font-medium">{employeeObjective.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
                                            {t('enums.objectiveLevel_EMPLOYEE')}
                                          </Badge>
                                          <Badge variant={STATUS_VARIANT[employeeObjective.status] ?? 'outline'}>
                                            {t(`enums.objectiveStatus_${employeeObjective.status}` as 'enums.objectiveStatus_DRAFT', { defaultValue: employeeObjective.status })}
                                          </Badge>
                                          {canActivateEmployee && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => onActivateObjective(employeeObjective.id)}
                                              disabled={activateObjectivePending}
                                            >
                                              {t('cascade.activate')}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

const createCycleSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['ANNUAL', 'QUARTERLY']),
  year: z.coerce.number().min(2020).max(2100),
  quarter: z.coerce.number().min(1).max(4).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  parentCycleId: z.string().uuid().optional(),
});

type CreateCycleValues = z.infer<typeof createCycleSchema>;

function CreateCycleDialog({ open, onClose, annualCycles }: {
  open: boolean;
  onClose: () => void;
  annualCycles: OkrCycleResponse[];
}) {
  const { t } = useTranslation(['okr', 'common']);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreateCycleValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: { type: 'ANNUAL' },
  });

  const cycleType = watch('type');

  const mutation = useMutation({
    mutationFn: (values: CreateCycleValues) =>
      createOkrCycle({
        name: values.name,
        type: values.type as OkrCycleType,
        year: values.year,
        quarter: values.quarter,
        startDate: values.startDate,
        endDate: values.endDate,
        parentCycleId: values.parentCycleId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      reset();
      setFormError(null);
      onClose();
    },
    onError: (err: unknown) => {
      setFormError(getGatewayErrorMessage(err, t('createCycleDialog.createFailed')));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createCycleDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('createCycleDialog.name')}</Label>
            <Input {...register('name')} placeholder={t('createCycleDialog.namePlaceholder')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>{t('createCycleDialog.type')}</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v as OkrCycleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUAL">{t('enums.cycleType_ANNUAL')}</SelectItem>
                <SelectItem value="QUARTERLY">{t('enums.cycleType_QUARTERLY')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('createCycleDialog.year')}</Label>
              <Input {...register('year')} type="number" placeholder="2026" />
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
            {cycleType === 'QUARTERLY' && (
              <div className="space-y-1">
                <Label>{t('createCycleDialog.quarter')}</Label>
                <Input {...register('quarter')} type="number" placeholder="1" min={1} max={4} />
                {errors.quarter && <p className="text-xs text-destructive">{errors.quarter.message}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('createCycleDialog.startDate')}</Label>
              <Input {...register('startDate')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>{t('createCycleDialog.endDate')}</Label>
              <Input {...register('endDate')} type="date" />
            </div>
          </div>

          {cycleType === 'QUARTERLY' && annualCycles.length > 0 && (
            <div className="space-y-1">
              <Label>{t('createCycleDialog.parentCycle')}</Label>
              <Select onValueChange={(v) => setValue('parentCycleId', v)}>
                <SelectTrigger><SelectValue placeholder={t('createCycleDialog.parentCyclePlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {annualCycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common:cancel')}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('createCycleDialog.creating') : t('createCycleDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OkrCycleManagement() {
  const { t } = useTranslation('okr');
  const { user } = useAuth();
  const isHrAdmin = user?.roles?.includes('HR_ADMIN') ?? false;
  const isManager = user?.roles?.includes('MANAGER') ?? false;

  const [createCycleOpen, setCreateCycleOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<OkrCycleResponse | null>(null);
  const [objectiveFormOpen, setObjectiveFormOpen] = useState(false);
  const [objectiveFormLevel, setObjectiveFormLevel] = useState<'COMPANY' | 'DEPARTMENT' | 'EMPLOYEE'>(
    isHrAdmin ? 'COMPANY' : 'DEPARTMENT',
  );
  const [objectiveFormParentId, setObjectiveFormParentId] = useState<string | undefined>(undefined);
  const [addKrForObjectiveId, setAddKrForObjectiveId] = useState<string | null>(null);
  const [collapsedObjectiveIds, setCollapsedObjectiveIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['okr-cycles'],
    queryFn: () => getOkrCycles({ limit: 50 }),
  });

  const cycles = data?.items ?? [];
  const annualCycles = cycles.filter((c) => c.type === 'ANNUAL');

  const { data: objectiveData } = useQuery({
    queryKey: ['objectives', selectedCycle?.id],
    queryFn: () => getObjectives({ cycleId: selectedCycle?.id, limit: 100 }),
    enabled: Boolean(selectedCycle),
  });

  const { data: parentCycleObjectiveData } = useQuery({
    queryKey: ['objectives', selectedCycle?.parentCycleId, 'company-parents'],
    queryFn: () =>
      getObjectives({
        cycleId: selectedCycle?.parentCycleId ?? undefined,
        level: 'COMPANY',
        status: 'ACTIVE',
        limit: 100,
      }),
    enabled: Boolean(selectedCycle?.parentCycleId),
  });

  const objectives = objectiveData?.items ?? [];
  const parentCycleCompanyObjectives = parentCycleObjectiveData?.items ?? [];
  const companyObjectives = useMemo(
    () =>
      Array.from(
        new Map(
          [...objectives.filter((objective) => objective.level === 'COMPANY'), ...parentCycleCompanyObjectives].map(
            (objective) => [objective.id, objective],
          ),
        ).values(),
      ),
    [objectives, parentCycleCompanyObjectives],
  );
  const departmentObjectives = useMemo(
    () => objectives.filter((objective) => objective.level === 'DEPARTMENT'),
    [objectives],
  );
  const employeeObjectives = useMemo(
    () => objectives.filter((objective) => objective.level === 'EMPLOYEE'),
    [objectives],
  );
  const objectiveCascadeRows = useMemo(
    () => buildObjectiveCascadeRows(companyObjectives, departmentObjectives, employeeObjectives, objectives),
    [companyObjectives, departmentObjectives, employeeObjectives, objectives],
  );
  const expandableObjectiveIds = useMemo(
    () =>
      [
        ...companyObjectives
          .filter((objective) => objectivesByParent(departmentObjectives, objective.id).length > 0)
          .map((objective) => objective.id),
        ...departmentObjectives
          .filter((objective) => objectivesByParent(employeeObjectives, objective.id).length > 0)
          .map((objective) => objective.id),
      ],
    [companyObjectives, departmentObjectives, employeeObjectives],
  );

  function openObjectiveForm(level: 'COMPANY' | 'DEPARTMENT' | 'EMPLOYEE', parentObjectiveId?: string): void {
    setObjectiveFormLevel(level);
    setObjectiveFormParentId(parentObjectiveId);
    setObjectiveFormOpen(true);
  }

  function toggleObjective(objectiveId: string): void {
    setCollapsedObjectiveIds((current) => {
      const next = new Set(current);
      if (next.has(objectiveId)) {
        next.delete(objectiveId);
      } else {
        next.add(objectiveId);
      }
      return next;
    });
  }

  function expandAllObjectives(): void {
    setCollapsedObjectiveIds(new Set());
  }

  function collapseAllObjectives(): void {
    setCollapsedObjectiveIds(new Set(expandableObjectiveIds));
  }

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(getGatewayErrorMessage(err, t('cycleManagement.actionFailed')));
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(getGatewayErrorMessage(err, t('cycleManagement.actionFailed')));
    },
  });

  const activateObjectiveMutation = useMutation({
    mutationFn: (id: string) => updateObjective(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(getGatewayErrorMessage(err, t('cycleManagement.activateObjectiveFailed')));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('cycleManagement.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('cycleManagement.subtitle')}</p>
        </div>
        {isHrAdmin && (
          <Button onClick={() => setCreateCycleOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('cycleManagement.createCycle')}
          </Button>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('cycleManagement.cycles')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('cycleManagement.loading')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cycleManagement.colName')}</TableHead>
                  <TableHead>{t('cycleManagement.colType')}</TableHead>
                  <TableHead>{t('cycleManagement.colPeriod')}</TableHead>
                  <TableHead>{t('cycleManagement.colStatus')}</TableHead>
                  {(isHrAdmin || isManager) && <TableHead className="text-right">{t('cycleManagement.colActions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow
                    key={cycle.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedCycle((prev) => prev?.id === cycle.id ? null : cycle)}
                  >
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell>{t(`enums.cycleType_${cycle.type}` as 'enums.cycleType_ANNUAL', { defaultValue: cycle.type })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {cycle.startDate} → {cycle.endDate}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[cycle.status] ?? 'outline'}>
                        {t(`enums.cycleStatus_${cycle.status}` as 'enums.cycleStatus_DRAFT', { defaultValue: cycle.status })}
                      </Badge>
                    </TableCell>
                    {(isHrAdmin || isManager) && (
                      <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        {isHrAdmin && cycle.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            onClick={() => activateMutation.mutate(cycle.id)}
                            disabled={activateMutation.isPending}
                          >
                            {t('cycleManagement.activate')}
                          </Button>
                        )}
                        {cycle.status === 'ACTIVE' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCycle(cycle);
                                openObjectiveForm(isHrAdmin ? 'COMPANY' : 'DEPARTMENT');
                              }}
                            >
                              {isHrAdmin ? t('cycleManagement.addObjective') : t('cycleManagement.addDepartmentObjective')}
                            </Button>
                            {isHrAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => closeMutation.mutate(cycle.id)}
                                disabled={closeMutation.isPending}
                              >
                                {t('cycleManagement.close')}
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCycle && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Network className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t('cycleManagement.cascadeHeading', { cycle: selectedCycle.name })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ObjectiveCascadeTree
              selectedCycle={selectedCycle}
              companyObjectives={companyObjectives}
              departmentObjectives={departmentObjectives}
              employeeObjectives={employeeObjectives}
              collapsedObjectiveIds={collapsedObjectiveIds}
              isHrAdmin={isHrAdmin}
              isManager={isManager}
              activateObjectivePending={activateObjectiveMutation.isPending}
              onToggleObjective={toggleObjective}
              onAddDepartmentObjective={(parentObjectiveId) => openObjectiveForm('DEPARTMENT', parentObjectiveId)}
              onAddEmployeeObjective={(parentObjectiveId) => openObjectiveForm('EMPLOYEE', parentObjectiveId)}
              onActivateObjective={(objectiveId) => activateObjectiveMutation.mutate(objectiveId)}
              onExpandAll={expandAllObjectives}
              onCollapseAll={collapseAllObjectives}
            />
          </CardContent>
        </Card>
      )}

      {selectedCycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('cycleManagement.objectivesHeading', { cycle: selectedCycle.name })}</CardTitle>
          </CardHeader>
          <CardContent>
            {objectiveCascadeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('cycleManagement.noObjectives')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cycleManagement.colObjective')}</TableHead>
                    <TableHead>{t('cycleManagement.colCascadeLevel')}</TableHead>
                    <TableHead>{t('cycleManagement.colAlignedUnder')}</TableHead>
                    <TableHead>{t('cycleManagement.colStatus')}</TableHead>
                    <TableHead className="text-right">{t('cycleManagement.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objectiveCascadeRows.map(({ objective, depth, parentTitle }) => {
                    const canActivate =
                      objective.status === 'DRAFT' &&
                      ((isHrAdmin && objective.level === 'COMPANY') ||
                        (isManager && objective.level === 'DEPARTMENT') ||
                        ((isHrAdmin || isManager) && objective.level === 'EMPLOYEE'));
                    const canAddKr =
                      objective.status === 'ACTIVE' &&
                      ((isHrAdmin && objective.level !== 'EMPLOYEE') ||
                        (isManager && objective.level === 'DEPARTMENT'));

                    return (
                      <TableRow key={objective.id}>
                        <TableCell>
                          <div
                            className="flex min-w-0 items-center gap-2"
                            style={{ paddingLeft: `${depth * 20}px` }}
                          >
                            {depth > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <span className="truncate font-medium">{objective.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {depth === 0
                              ? t('enums.objectiveLevel_COMPANY')
                              : depth === 1
                                ? t('enums.objectiveLevel_DEPARTMENT')
                                : t('enums.objectiveLevel_EMPLOYEE')}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                          {parentTitle ?? (objective.parentObjectiveId ? t('cycleManagement.parentOutsideView') : t('cycleManagement.topLevel'))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[objective.status] ?? 'outline'}>
                            {t(`enums.objectiveStatus_${objective.status}` as 'enums.objectiveStatus_DRAFT', { defaultValue: objective.status })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {canActivate && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateObjectiveMutation.mutate(objective.id)}
                              disabled={activateObjectiveMutation.isPending}
                            >
                              {t('cycleManagement.activate')}
                            </Button>
                          )}
                          {canAddKr && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddKrForObjectiveId(objective.id)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t('cycleManagement.keyResult')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedCycle && (isManager || isHrAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('cycleManagement.approvalsHeading', { cycle: selectedCycle.name })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('cycleManagement.approvalsDescription')}
            </p>
          </CardHeader>
          <CardContent>
            <OkrApprovalQueue cycleId={selectedCycle.id} />
          </CardContent>
        </Card>
      )}

      {selectedCycle && isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('cycleManagement.checkInHeading', { cycle: selectedCycle.name })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CheckInReviewQueue cycleId={selectedCycle.id} />
          </CardContent>
        </Card>
      )}

      <CreateCycleDialog
        open={createCycleOpen}
        onClose={() => setCreateCycleOpen(false)}
        annualCycles={annualCycles}
      />

      {selectedCycle && objectiveFormOpen && (
        <ObjectiveForm
          open={objectiveFormOpen}
          onClose={() => {
            setObjectiveFormOpen(false);
            setObjectiveFormParentId(undefined);
          }}
          cycleId={selectedCycle.id}
          initialLevel={objectiveFormLevel}
          initialParentObjectiveId={objectiveFormParentId}
        />
      )}

      {selectedCycle && addKrForObjectiveId && (
        <KeyResultForm
          open={true}
          onClose={() => setAddKrForObjectiveId(null)}
          objectiveId={addKrForObjectiveId}
          cycleEndDate={selectedCycle.endDate}
        />
      )}
    </div>
  );
}
