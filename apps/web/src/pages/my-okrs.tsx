import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  getOkrCycles,
  getEmployeeOkrPortfolio,
  OkrCycleResponse,
  KeyResultResponse,
} from '@/lib/api/hr-core';
import { CycleSelector } from '@/components/okrs/cycle-selector';
import { ObjectiveForm } from '@/components/okrs/objective-form';
import { CheckInForm } from '@/components/okrs/check-in-form';
import { CheckInHistory } from '@/components/okrs/check-in-history';
import { KrProgressBar } from '@/components/okrs/kr-progress-bar';
import { useAuth } from '@/components/providers/auth-provider';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  DRAFT: 'secondary',
  CLOSED: 'outline',
  CANCELLED: 'destructive',
};

const KR_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ON_TRACK: 'default',
  AT_RISK: 'destructive',
  ACHIEVED: 'secondary',
  CANCELLED: 'outline',
};

interface KrPanelProps {
  kr: KeyResultResponse;
}

function KrPanel({ kr }: KrPanelProps) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium flex-1">{kr.title}</span>
        <Badge variant={KR_STATUS_VARIANT[kr.status] ?? 'outline'} className="shrink-0">
          {kr.status.replace('_', ' ')}
        </Badge>
      </div>
      <KrProgressBar score={Number(kr.score)} isAtRisk={kr.isAtRisk} />
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{kr.currentValue} / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}</span>
        <span>{Math.round(Number(kr.score) * 100)}%</span>
      </div>
      <div className="flex gap-2">
        {kr.status === 'ON_TRACK' || kr.status === 'AT_RISK' ? (
          <Button size="sm" variant="outline" onClick={() => setCheckInOpen(true)}>
            Submit Check-in
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((x) => !x)}>
          {historyOpen ? 'Hide History' : 'History'}
        </Button>
      </div>
      {historyOpen && <CheckInHistory keyResultId={kr.id} />}
      {checkInOpen && (
        <CheckInForm open={checkInOpen} onClose={() => setCheckInOpen(false)} kr={kr} />
      )}
    </div>
  );
}

export default function MyOkrs() {
  const { user } = useAuth();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [objectiveFormOpen, setObjectiveFormOpen] = useState(false);

  const { data: cyclesData } = useQuery({
    queryKey: ['okr-cycles', 'active'],
    queryFn: () => getOkrCycles({ status: 'ACTIVE', limit: 20 }),
  });

  const activeCycles = cyclesData?.items ?? [];

  const effectiveCycleId = selectedCycleId || activeCycles[0]?.id || '';

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['employee-okr-portfolio', user?.employeeId, effectiveCycleId],
    queryFn: () => getEmployeeOkrPortfolio(user!.employeeId!, effectiveCycleId),
    enabled: !!user?.employeeId && !!effectiveCycleId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My OKRs</h1>
          <p className="text-muted-foreground text-sm">Track your personal objectives and key results</p>
        </div>
        <div className="flex items-center gap-3">
          <CycleSelector
            value={selectedCycleId || activeCycles[0]?.id || ''}
            onChange={setSelectedCycleId}
            cycles={activeCycles}
          />
          {effectiveCycleId && (
            <Button onClick={() => setObjectiveFormOpen(true)}>
              + Personal Objective
            </Button>
          )}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your OKRs…</p>}

      {!effectiveCycleId && !isLoading && (
        <p className="text-sm text-muted-foreground">No active OKR cycle found.</p>
      )}

      {portfolio && (
        <>
          {/* Personal objectives owned */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">My Personal Objectives</h2>
            {portfolio.objectivesOwned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No personal objectives yet.</p>
            ) : (
              portfolio.objectivesOwned.map(({ objective, keyResults, averageScore }) => (
                <Card key={objective.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium">{objective.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[objective.status] ?? 'outline'}>
                          {objective.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(averageScore * 100)}% avg
                        </span>
                      </div>
                    </div>
                    {objective.description && (
                      <p className="text-xs text-muted-foreground">{objective.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {keyResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No key results yet.</p>
                    ) : (
                      keyResults.map((kr) => <KrPanel key={kr.id} kr={kr} />)
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {/* KRs assigned to me (on team/dept objectives) */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">KRs Assigned to Me</h2>
            {portfolio.keyResultsAssigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No key results assigned to you.</p>
            ) : (
              portfolio.keyResultsAssigned.map(({ keyResult, parentObjective }) => (
                <Card key={keyResult.id}>
                  <CardHeader className="pb-1">
                    <p className="text-xs text-muted-foreground">
                      {parentObjective.level} — {parentObjective.title}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <KrPanel kr={keyResult} />
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      )}

      {effectiveCycleId && objectiveFormOpen && (
        <ObjectiveForm
          open={objectiveFormOpen}
          onClose={() => setObjectiveFormOpen(false)}
          cycleId={effectiveCycleId}
          initialLevel="EMPLOYEE"
        />
      )}
    </div>
  );
}
