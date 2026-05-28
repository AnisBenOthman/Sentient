import { CheckCircle2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QualityReport } from '@/lib/okr-quality';

interface OkrQualityPanelProps {
  report: QualityReport;
  className?: string;
}

function badgeVariant(score: number, total: number): 'default' | 'secondary' | 'destructive' {
  if (score <= Math.floor(total / 3)) return 'destructive';
  if (score < total) return 'secondary';
  return 'default';
}

export function OkrQualityPanel({ report, className }: OkrQualityPanelProps) {
  const allPass = report.score === report.total;

  return (
    <div
      className={cn(
        'rounded-md border bg-muted/30 px-3 py-3 space-y-2',
        className,
      )}
      data-testid="okr-quality-panel"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          OKR strength
        </span>
        <Badge variant={badgeVariant(report.score, report.total)} className="text-xs">
          {report.score} / {report.total}
        </Badge>
      </div>

      <ul className="space-y-1.5">
        {report.results.map((r) => (
          <li key={r.criterion} className="flex items-start gap-2 text-xs">
            {r.pass ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={cn('font-medium', r.pass ? 'text-foreground' : 'text-destructive')}>
                {r.label}
              </p>
              {!r.pass && r.hint && (
                <p className="text-muted-foreground mt-0.5">{r.hint}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!allPass && (
        <p className="text-[11px] text-muted-foreground italic">
          Advisory only — you can still save. Strong OKRs are specific, measurable, tied to impact, and time-bound.
        </p>
      )}
    </div>
  );
}
