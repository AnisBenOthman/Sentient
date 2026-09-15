import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClockIcon, UserCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getEmployee, getObjectives, updateObjective, type ObjectiveResponse } from '@/lib/api/hr-core';
import { useAuth } from '@/components/providers/auth-provider';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';
import { useState } from 'react';

interface ObjectiveApprovalCardProps {
  objective: ObjectiveResponse;
  onApprove: () => void;
  isApproving: boolean;
}

function ObjectiveApprovalCard({ objective, onApprove, isApproving }: ObjectiveApprovalCardProps) {
  const { data: employee } = useQuery({
    queryKey: ['employee', objective.ownerId],
    queryFn: () => getEmployee(objective.ownerId!),
    enabled: !!objective.ownerId,
    staleTime: 5 * 60 * 1000,
  });

  const employeeName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : '—';

  const roleTitle = employee?.position?.title ?? null;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{employeeName}</span>
            {roleTitle && <span className="text-muted-foreground">— {roleTitle}</span>}
          </div>
          <Badge variant="secondary" className="text-[10px]">
            <ClockIcon className="mr-1 h-2.5 w-2.5" />
            Pending approval
          </Badge>
        </div>
        <p className="text-sm font-medium leading-snug">{objective.title}</p>
        {objective.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {objective.description}
          </p>
        )}
      </div>
      <Button
        size="sm"
        onClick={onApprove}
        disabled={isApproving}
        className="shrink-0"
      >
        {isApproving ? 'Approving…' : 'Approve'}
      </Button>
    </div>
  );
}

interface OkrApprovalQueueProps {
  cycleId: string;
}

export function OkrApprovalQueue({ cycleId }: OkrApprovalQueueProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isHrAdmin = user?.roles?.includes('HR_ADMIN') ?? false;
  const [approveError, setApproveError] = useState<string | null>(null);

  const { data: draftObjectives, isLoading } = useQuery({
    queryKey: ['objectives', cycleId, 'pending-approval', user?.departmentId, isHrAdmin],
    queryFn: () =>
      getObjectives({
        cycleId,
        level: 'EMPLOYEE',
        status: 'DRAFT',
        limit: 50,
        ...(!isHrAdmin && user?.departmentId ? { departmentId: user.departmentId } : {}),
      }),
    enabled: !!cycleId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => updateObjective(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setApproveError(null);
    },
    onError: (err: unknown) => {
      setApproveError(getGatewayErrorMessage(err, 'Could not approve objective.'));
    },
  });

  const objectives = draftObjectives?.items ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (objectives.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employee objectives pending approval in this cycle.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {approveError && <p className="text-sm text-destructive">{approveError}</p>}
      {objectives.map((objective) => (
        <ObjectiveApprovalCard
          key={objective.id}
          objective={objective}
          onApprove={() => approveMutation.mutate(objective.id)}
          isApproving={approveMutation.isPending}
        />
      ))}
    </div>
  );
}
