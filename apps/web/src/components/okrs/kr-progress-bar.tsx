import { cn } from '@/lib/utils';

interface KrProgressBarProps {
  score: number;
  isAtRisk: boolean;
  className?: string;
}

export function KrProgressBar({ score, isAtRisk, className }: KrProgressBarProps) {
  const pct = Math.min(Math.round(score * 100), 100);
  return (
    <div className={cn('h-2 w-full rounded-full bg-muted overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all', isAtRisk ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
