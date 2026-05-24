import { Badge } from '@/components/ui/badge';
import { KeyResultResponse } from '@/lib/api/hr-core';
import { KrProgressBar } from './kr-progress-bar';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ON_TRACK: 'default',
  AT_RISK: 'destructive',
  ACHIEVED: 'secondary',
  CANCELLED: 'outline',
};

interface KrRowProps {
  kr: KeyResultResponse;
  actions?: React.ReactNode;
}

export function KrRow({ kr, actions }: KrRowProps) {
  const pct = Math.round(Number(kr.score) * 100);
  const progress = kr.metricType === 'BOOLEAN'
    ? `${kr.currentValue === '1' ? 'Done' : 'Pending'}`
    : `${kr.currentValue}${kr.unit ? ` ${kr.unit}` : ''} / ${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ''}`;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium flex-1">{kr.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={STATUS_VARIANT[kr.status] ?? 'outline'}>{kr.status.replace('_', ' ')}</Badge>
          {actions}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <KrProgressBar score={Number(kr.score)} isAtRisk={kr.isAtRisk} className="flex-1" />
        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
        <span className="text-xs text-muted-foreground">{progress}</span>
      </div>
    </div>
  );
}
