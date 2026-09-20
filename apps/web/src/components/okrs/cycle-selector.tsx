import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OkrCycleResponse } from '@/lib/api/hr-core';

interface CycleSelectorProps {
  value: string;
  onChange: (id: string) => void;
  cycles: OkrCycleResponse[];
}

export function CycleSelector({ value, onChange, cycles }: CycleSelectorProps) {
  const { t } = useTranslation('okr');
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder={t('cycleSelector.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {c.status === 'CLOSED' && (
              <span className="ml-2 text-xs text-muted-foreground">{t('cycleSelector.closedSuffix')}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
