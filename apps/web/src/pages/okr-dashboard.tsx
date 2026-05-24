import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Target, List } from 'lucide-react';

import {
  getOkrCycles,
  getOkrCycleSummary,
  getEmployeeOkrPortfolio,
} from '@/lib/api/hr-core';
import { CycleSelector } from '@/components/okrs/cycle-selector';
import { DepartmentProgressCard } from '@/components/okrs/department-progress-card';
import { AlignmentTree } from '@/components/okrs/alignment-tree';
import { KrProgressBar } from '@/components/okrs/kr-progress-bar';
import { useAuth } from '@/components/providers/auth-provider';

export default function OkrDashboard() {
  const { user } = useAuth();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  const isEmployee = (user?.roles ?? []).includes('EMPLOYEE') &&
    !(user?.roles ?? []).includes('MANAGER') &&
    !(user?.roles ?? []).includes('HR_ADMIN') &&
    !(user?.roles ?? []).includes('EXECUTIVE');

  const { data: cyclesData } = useQuery({
    queryKey: ['okr-cycles'],
    queryFn: () => getOkrCycles({ limit: 50 }),
  });

  const cycles = cyclesData?.items ?? [];
  const effectiveCycleId = selectedCycleId || cycles.find((c) => c.status === 'ACTIVE')?.id || cycles[0]?.id || '';
  const selectedCycle = cycles.find((c) => c.id === effectiveCycleId);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['okr-cycle-summary', effectiveCycleId],
    queryFn: () => getOkrCycleSummary(effectiveCycleId),
    enabled: !!effectiveCycleId,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['employee-okr-portfolio', user?.employeeId, effectiveCycleId],
    queryFn: () => getEmployeeOkrPortfolio(user!.employeeId!, effectiveCycleId),
    enabled: isEmployee && !!user?.employeeId && !!effectiveCycleId,
  });

  const totalObjectives = summary?.departments.reduce((s, d) => s + d.objectiveCount, 0) ?? 0;
  const totalKrs = summary?.departments.reduce((s, d) => s + d.krCount, 0) ?? 0;
  const totalAtRisk = summary?.atRiskKrs.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OKR Dashboard</h1>
          <p className="text-muted-foreground text-sm">Cycle-wide health overview</p>
        </div>
        <div className="flex items-center gap-3">
          <CycleSelector
            value={effectiveCycleId}
            onChange={setSelectedCycleId}
            cycles={cycles}
          />
          {selectedCycle?.status === 'CLOSED' && (
            <Badge variant="outline">CLOSED</Badge>
          )}
        </div>
      </div>

      {summaryLoading && <p className="text-sm text-muted-foreground">Loading summary…</p>}

      {summary && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center gap-4 pt-4">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalObjectives}</p>
                  <p className="text-xs text-muted-foreground">Total Objectives</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-4">
                <List className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalKrs}</p>
                  <p className="text-xs text-muted-foreground">Key Results</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-4">
                <AlertTriangle className={`h-8 w-8 ${totalAtRisk > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-2xl font-bold ${totalAtRisk > 0 ? 'text-destructive' : ''}`}>{totalAtRisk}</p>
                  <p className="text-xs text-muted-foreground">At Risk KRs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department progress */}
          {summary.departments.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Department Progress</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.departments.map((dept) => (
                  <DepartmentProgressCard key={dept.departmentId} dept={dept} />
                ))}
              </div>
            </section>
          )}

          {/* Top-level alignment tree */}
          {summary.topLevelObjectives.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Company Objective Alignment</h2>
              <Card>
                <CardContent className="pt-4">
                  <AlignmentTree objectives={summary.topLevelObjectives} />
                </CardContent>
              </Card>
            </section>
          )}

          {/* At-risk KRs table */}
          {summary.atRiskKrs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">At-Risk Key Results</h2>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  {summary.atRiskKrs.map((kr) => (
                    <div key={kr.keyResultId} className="flex items-center gap-3 py-1">
                      <span className="flex-1 text-sm">{kr.title}</span>
                      <KrProgressBar score={kr.score} isAtRisk className="w-24" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {Math.round(kr.score * 100)}%
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      {/* Employee portfolio section */}
      {isEmployee && portfolio && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your Portfolio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Personal Objectives</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolio.objectivesOwned.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None yet.</p>
                ) : (
                  portfolio.objectivesOwned.map(({ objective, averageScore }) => (
                    <div key={objective.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{objective.title}</span>
                      <KrProgressBar score={averageScore} isAtRisk={averageScore < 0.3} className="w-20" />
                      <span className="text-xs w-8 text-right">{Math.round(averageScore * 100)}%</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Assigned Key Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolio.keyResultsAssigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None assigned.</p>
                ) : (
                  portfolio.keyResultsAssigned.map(({ keyResult }) => (
                    <div key={keyResult.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{keyResult.title}</span>
                      <KrProgressBar
                        score={Number(keyResult.score)}
                        isAtRisk={keyResult.isAtRisk}
                        className="w-20"
                      />
                      <span className="text-xs w-8 text-right">
                        {Math.round(Number(keyResult.score) * 100)}%
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
