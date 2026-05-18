import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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
  CreateObjectivePayload,
} from '@/lib/api/hr-core';
import { ObjectiveForm } from '@/components/okrs/objective-form';
import { CheckInReviewQueue } from '@/components/okrs/check-in-review-queue';
import { useAuth } from '@/components/providers/auth-provider';

const CYCLE_ERROR_MAP: Record<string, string> = {
  CycleNameTaken: 'A cycle with this name already exists.',
  InvalidQuarter: 'Quarter must be 1–4 for quarterly cycles.',
  ParentMustBeAnnual: 'Parent cycle must be an annual cycle.',
  EndBeforeStart: 'End date must be after start date.',
  CycleNotDraft: 'Cycle must be in Draft status to activate.',
  EndDateInPast: 'Cannot activate a cycle whose end date is in the past.',
};

function extractApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string } } }).response;
    return r?.data?.message ?? 'Unknown error';
  }
  return String(err);
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  DRAFT: 'secondary',
  CLOSED: 'outline',
};

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
      const code = extractApiError(err);
      setFormError(CYCLE_ERROR_MAP[code] ?? 'Failed to create cycle. Please try again.');
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
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['okr-cycles'],
    queryFn: () => getOkrCycles({ limit: 50 }),
  });

  const cycles = data?.items ?? [];
  const annualCycles = cycles.filter((c) => c.type === 'ANNUAL');

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      const code = extractApiError(err);
      setActionError(CYCLE_ERROR_MAP[code] ?? 'Action failed.');
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeCycle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okr-cycles'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      const code = extractApiError(err);
      setActionError(CYCLE_ERROR_MAP[code] ?? 'Action failed.');
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
                  {isHrAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                    {isHrAdmin && (
                      <TableCell className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        {cycle.status === 'DRAFT' && (
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
                                setObjectiveFormOpen(true);
                              }}
                            >
                              + Objective
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => closeMutation.mutate(cycle.id)}
                              disabled={closeMutation.isPending}
                            >
                              Close
                            </Button>
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
          onClose={() => setObjectiveFormOpen(false)}
          cycleId={selectedCycle.id}
          initialLevel="COMPANY"
        />
      )}
    </div>
  );
}
