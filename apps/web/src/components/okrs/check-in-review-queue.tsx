import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  getObjectives,
  getKeyResults,
  getCheckIns,
  approveCheckIn,
  rejectCheckIn,
  OkrCheckInResponse,
} from '@/lib/api/hr-core';
import { useAuth } from '@/components/providers/auth-provider';
import { getGatewayErrorMessage } from '@/lib/api/gateway-error';

interface RejectDialogProps {
  checkIn: OkrCheckInResponse;
  onClose: () => void;
}

function RejectDialog({ checkIn, onClose }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => rejectCheckIn(checkIn.id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      onClose();
    },
    onError: (err: unknown) => {
      setError(getGatewayErrorMessage(err, 'Failed to reject check-in.'));
    },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Check-in</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this check-in is rejected…"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CheckInReviewQueueProps {
  cycleId: string;
}

export function CheckInReviewQueue({ cycleId }: CheckInReviewQueueProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<OkrCheckInResponse | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const { data: objectives, isLoading: objLoading } = useQuery({
    queryKey: ['objectives', cycleId, user?.departmentId],
    queryFn: () =>
      getObjectives({ cycleId, departmentId: user?.departmentId ?? undefined, level: 'DEPARTMENT' }),
    enabled: !!cycleId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCheckIn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      setApproveError(null);
    },
    onError: (err: unknown) => {
      setApproveError(getGatewayErrorMessage(err, 'Failed to approve check-in.'));
    },
  });

  if (objLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const objectiveIds = objectives?.items.map((o) => o.id) ?? [];

  if (!objectiveIds.length) {
    return <p className="text-sm text-muted-foreground">No department objectives in this cycle.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Pending Check-ins</h3>
      {approveError && <p className="text-sm text-destructive">{approveError}</p>}
      {objectiveIds.map((objId) => (
        <ObjectiveCheckIns
          key={objId}
          objectiveId={objId}
          onApprove={(ci) => approveMutation.mutate(ci.id)}
          onReject={(ci) => setRejectTarget(ci)}
          isApproving={approveMutation.isPending}
        />
      ))}
      {rejectTarget && (
        <RejectDialog checkIn={rejectTarget} onClose={() => setRejectTarget(null)} />
      )}
    </div>
  );
}

function ObjectiveCheckIns({
  objectiveId,
  onApprove,
  onReject,
  isApproving,
}: {
  objectiveId: string;
  onApprove: (ci: OkrCheckInResponse) => void;
  onReject: (ci: OkrCheckInResponse) => void;
  isApproving: boolean;
}) {
  const { data: krs } = useQuery({
    queryKey: ['key-results', objectiveId],
    queryFn: () => getKeyResults(objectiveId),
  });

  return (
    <>
      {krs?.items.map((kr) => (
        <KrCheckIns
          key={kr.id}
          krTitle={kr.title}
          keyResultId={kr.id}
          onApprove={onApprove}
          onReject={onReject}
          isApproving={isApproving}
        />
      ))}
    </>
  );
}

function KrCheckIns({
  krTitle,
  keyResultId,
  onApprove,
  onReject,
  isApproving,
}: {
  krTitle: string;
  keyResultId: string;
  onApprove: (ci: OkrCheckInResponse) => void;
  onReject: (ci: OkrCheckInResponse) => void;
  isApproving: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['check-ins', keyResultId],
    queryFn: () => getCheckIns(keyResultId),
  });

  const pending = data?.items.filter((ci) => ci.status === 'PENDING') ?? [];
  if (!pending.length) return null;

  return (
    <div className="rounded border p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{krTitle}</p>
      {pending.map((ci) => (
        <div key={ci.id} className="flex items-center justify-between gap-2 text-sm">
          <div className="flex-1">
            <span>Value: <strong>{ci.value}</strong></span>
            {ci.comment && <span className="text-muted-foreground ml-2">— {ci.comment}</span>}
          </div>
          <Badge variant="secondary">Pending</Badge>
          <Button
            size="sm"
            onClick={() => onApprove(ci)}
            disabled={isApproving}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(ci)}
          >
            Reject
          </Button>
        </div>
      ))}
    </div>
  );
}
