import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QualityReport } from '@/lib/okr-quality';

interface OkrQualityPanelProps {
  report: QualityReport;
  className?: string;
}

function scoreTheme(score: number, total: number) {
  const pct = score / total;
  if (pct === 1) return { text: 'text-emerald-600 dark:text-emerald-400', label: 'Strong' };
  if (pct >= 2 / 3) return { text: 'text-amber-600 dark:text-amber-400', label: 'Good' };
  return { text: 'text-rose-600 dark:text-rose-400', label: 'Weak' };
}

export function OkrQualityPanel({ report, className }: OkrQualityPanelProps) {
  const { score, total, results } = report;
  const theme = scoreTheme(score, total);

  return (
    <div
      className={cn('rounded-lg border bg-card shadow-sm overflow-hidden', className)}
      data-testid="okr-quality-panel"
    >
      {/* Segmented score bar */}
      <div className="flex gap-0.5 p-1 bg-muted/50">
        {results.map((r) => (
          <div
            key={r.criterion}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-500',
              r.pass
                ? r.autoPass
                  ? 'bg-emerald-300 dark:bg-emerald-800'
                  : 'bg-emerald-500'
                : 'bg-rose-400',
            )}
          />
        ))}
      </div>

      <div className="px-3 pt-2 pb-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Quality Coach
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[10px] font-medium', theme.text)}>{theme.label}</span>
            <span className={cn('text-sm font-bold tabular-nums', theme.text)}>
              {score}
              <span className="text-muted-foreground/60 font-normal text-xs">/{total}</span>
            </span>
          </div>
        </div>

        {/* Criteria list */}
        <ul className="space-y-1">
          {results.map((r) => (
            <li
              key={r.criterion}
              className={cn(
                'flex items-start gap-2 rounded-md px-2 py-1.5 text-xs',
                !r.pass && 'bg-rose-50 dark:bg-rose-950/30',
              )}
            >
              {r.pass ? (
                <CheckCircle2
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 mt-px',
                    r.autoPass
                      ? 'text-emerald-400 dark:text-emerald-600'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-px" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'font-medium leading-tight',
                    r.pass
                      ? r.autoPass
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {r.label}
                  {r.autoPass && r.pass && (
                    <span className="ml-1.5 font-normal text-[9px] text-muted-foreground/50 tracking-widest uppercase">
                      by cycle
                    </span>
                  )}
                </p>
                {!r.pass && r.hint && (
                  <p className="mt-0.5 text-muted-foreground leading-snug">{r.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
