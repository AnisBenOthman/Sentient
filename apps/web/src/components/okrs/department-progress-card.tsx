import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DepartmentSummary } from '@/lib/api/hr-core';
import { KrProgressBar } from './kr-progress-bar';

interface DepartmentProgressCardProps {
  dept: DepartmentSummary;
}

export function DepartmentProgressCard({ dept }: DepartmentProgressCardProps) {
  const pct = Math.round(dept.averageScore * 100);
  const isAtRisk = dept.atRiskCount > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{dept.departmentName}</CardTitle>
          {isAtRisk && (
            <Badge variant="destructive">{dept.atRiskCount} at risk</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <KrProgressBar score={dept.averageScore} isAtRisk={isAtRisk} className="flex-1" />
          <span className="text-sm font-semibold w-10 text-right">{pct}%</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{dept.objectiveCount} objectives</span>
          <span>{dept.krCount} key results</span>
        </div>
      </CardContent>
    </Card>
  );
}
