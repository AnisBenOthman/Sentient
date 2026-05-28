import { useMemo, useState } from 'react';
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

function childCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
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
  if (companyObjectives.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
        No company objectives are active in this cycle yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Network className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Cascade tree
          <span className="text-xs font-normal text-muted-foreground">
            Expand or reduce each parent objective.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-8" onClick={onExpandAll}>
            Expand all
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onCollapseAll}>
            Reduce all
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
                        Company
                      </Badge>
                      <Badge variant={STATUS_VARIANT[companyObjective.status] ?? 'outline'}>
                        {companyObjective.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {childCountLabel(linkedDepartments.length, 'department child', 'department children')}
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
                    Department objective
                  </Button>
                )}
              </div>

              {companyExpanded && (
                <div className="space-y-3 p-4">
                  {linkedDepartments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50">
                      No department objectives linked to this company objective yet.
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
                                      Department
                                    </Badge>
                                    <Badge variant={STATUS_VARIANT[departmentObjective.status] ?? 'outline'}>
                                      {departmentObjective.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {childCountLabel(linkedEmployees.length, 'employee child', 'employee children')}
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
                                    Activate
                                  </Button>
                                )}
                                {departmentObjective.status === 'ACTIVE' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onAddEmployeeObjective(departmentObjective.id)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Employee objective
                                  </Button>
                                )}
                              </div>
                            </div>

                            {departmentExpanded && (
                              <div className="mt-3 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-800">
                                {linkedEmployees.length === 0 ? (
                                  <p className="rounded-md bg-white px-3 py-2 text-sm text-muted-foreground dark:bg-slate-950">
                                    No employee objectives linked yet.
                                  </p>
                                ) : (
                                  linkedEmployees.map((employeeObjective) => (
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
                                          Employee
                                        </Badge>
                                        <Badge variant={STATUS_VARIANT[employeeObjective.status] ?? 'outline'}>
                                          {employeeObjective.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))
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
      setFormError(getGatewayErrorMessage(err, 'Failed to create cycle. Please try again.'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create OKR Cycle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input {...register('name')} placeholder="e.g. FY 2026" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v as OkrCycleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUAL">Annual</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Year *</Label>
              <Input {...register('year')} type="number" placeholder="2026" />
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
            {cycleType === 'QUARTERLY' && (
              <div className="space-y-1">
                <Label>Quarter *</Label>
                <Input {...register('quarter')} type="number" placeholder="1" min={1} max={4} />
                {errors.quarter && <p className="text-xs text-destructive">{errors.quarter.message}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date *</Label>
              <Input {...register('startDate')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>End Date *</Label>
              <Input {...register('endDate')} type="date" />
            </div>
          </div>

          {cycleType === 'QUARTERLY' && annualCycles.length > 0 && (
            <div className="space-y-1">
              <Label>Parent Annual Cycle</Label>
              <Select onValueChange={(v) => setValue('parentCycleId', v)}>
                <SelectTrigger><SelectValue placeholder="Select annual cycle…" /></SelectTrigger>
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
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function OkrCycleManagement() {
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
      setActionError(getGatewayErrorMessage(err, 'Action failed.'));
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(getGatewayErrorMessage(err, 'Action failed.'));
    },
  });

  const activateObjectiveMutation = useMutation({
    mutationFn: (id: string) => updateObjective(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(getGatewayErrorMessage(err, 'Could not activate objective.'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OKR Cycle Management</h1>
          <p className="text-muted-foreground text-sm">Manage OKR cycles and objectives</p>
        </div>
        {isHrAdmin && (
          <Button onClick={() => setCreateCycleOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Cycle
          </Button>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cycles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  {(isHrAdmin || isManager) && <TableHead className="text-right">Actions</TableHead>}
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
                    <TableCell>{cycle.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {cycle.startDate} → {cycle.endDate}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[cycle.status] ?? 'outline'}>
                        {cycle.status}
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
                            Activate
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
                              {isHrAdmin ? '+ Objective' : '+ Department Objective'}
                            </Button>
                            {isHrAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => closeMutation.mutate(cycle.id)}
                                disabled={closeMutation.isPending}
                              >
                                Close
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
              Cascade — {selectedCycle.name}
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
            <div className="hidden">
            {companyObjectives.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No company objectives are active in this cycle yet.
              </p>
            ) : (
              <div className="space-y-3">
                {companyObjectives.map((companyObjective) => {
                  const linkedDepartments = objectivesByParent(departmentObjectives, companyObjective.id);

                  return (
                    <div
                      key={companyObjective.id}
                      className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Company</Badge>
                            <Badge variant={STATUS_VARIANT[companyObjective.status] ?? 'outline'}>
                              {companyObjective.status}
                            </Badge>
                          </div>
                          <p className="mt-2 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {companyObjective.title}
                          </p>
                        </div>
                        {selectedCycle.status === 'ACTIVE' && companyObjective.status === 'ACTIVE' && (isManager || isHrAdmin) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openObjectiveForm('DEPARTMENT', companyObjective.id)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Department objective
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 space-y-2 border-l border-gray-200 pl-4 dark:border-gray-800">
                        {linkedDepartments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No department objectives linked to this company objective yet.
                          </p>
                        ) : (
                          linkedDepartments.map((departmentObjective) => {
                            const linkedEmployees = objectivesByParent(employeeObjectives, departmentObjective.id);
                            const canActivateDepartment =
                              departmentObjective.status === 'DRAFT' &&
                              ((isHrAdmin && departmentObjective.level === 'DEPARTMENT') || isManager);

                            return (
                              <div
                                key={departmentObjective.id}
                                className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                      <Badge variant="outline">Department</Badge>
                                      <Badge variant={STATUS_VARIANT[departmentObjective.status] ?? 'outline'}>
                                        {departmentObjective.status}
                                      </Badge>
                                    </div>
                                    <p className="mt-2 truncate text-sm font-medium">
                                      {departmentObjective.title}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {canActivateDepartment && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => activateObjectiveMutation.mutate(departmentObjective.id)}
                                        disabled={activateObjectiveMutation.isPending}
                                      >
                                        Activate
                                      </Button>
                                    )}
                                    {departmentObjective.status === 'ACTIVE' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openObjectiveForm('EMPLOYEE', departmentObjective.id)}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Employee objective
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {linkedEmployees.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {linkedEmployees.map((employeeObjective) => (
                                      <Badge key={employeeObjective.id} variant="secondary">
                                        Employee · {employeeObjective.title}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Objectives — {selectedCycle.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {objectiveCascadeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No objectives created for this cycle yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objective</TableHead>
                    <TableHead>Cascade Level</TableHead>
                    <TableHead>Aligned Under</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objectiveCascadeRows.map(({ objective, depth, parentTitle }) => {
                    const canActivate =
                      objective.status === 'DRAFT' &&
                      ((isHrAdmin && objective.level === 'COMPANY') ||
                        (isManager && objective.level === 'DEPARTMENT'));
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
                            {depth === 0 ? 'Company' : depth === 1 ? 'Department' : 'Employee'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                          {parentTitle ?? (objective.parentObjectiveId ? 'Parent outside this view' : 'Top level')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[objective.status] ?? 'outline'}>
                            {objective.status}
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
                              Activate
                            </Button>
                          )}
                          {canAddKr && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddKrForObjectiveId(objective.id)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Key Result
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

      {selectedCycle && isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Check-in Review — {selectedCycle.name}
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
