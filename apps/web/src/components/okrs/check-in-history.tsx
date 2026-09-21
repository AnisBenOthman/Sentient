import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { getCheckIns } from '@/lib/api/hr-core';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  APPROVED: 'default',
  REJECTED: 'destructive',
  PENDING: 'secondary',
};

interface CheckInHistoryProps {
  keyResultId: string;
}

export function CheckInHistory({ keyResultId }: CheckInHistoryProps) {
  const { t, i18n } = useTranslation('okr');
  const { data, isLoading } = useQuery({
    queryKey: ['check-ins', keyResultId],
    queryFn: () => getCheckIns(keyResultId),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">{t('checkInHistory.loading')}</p>;
  if (!data?.items.length) return <p className="text-xs text-muted-foreground">{t('checkInHistory.empty')}</p>;

  return (
    <ul className="space-y-2">
      {data.items.map((ci) => (
        <li key={ci.id} className="rounded border p-2 text-sm space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{t('checkInHistory.value')} {ci.value}</span>
            <Badge variant={STATUS_VARIANT[ci.status] ?? 'outline'}>
              {t(`enums.checkInStatus_${ci.status}` as 'enums.checkInStatus_PENDING', { defaultValue: ci.status })}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(ci.createdAt).toLocaleDateString(i18n.language)}
            {ci.comment && ` — ${ci.comment}`}
          </p>
          {ci.status === 'REJECTED' && ci.rejectionReason && (
            <p className="text-xs text-destructive">{t('checkInHistory.reason')} {ci.rejectionReason}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
