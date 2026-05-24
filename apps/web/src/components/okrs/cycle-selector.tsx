import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OkrCycleResponse } from '@/lib/api/hr-core';

interface CycleSelectorProps {
  value: string;
  onChange: (id: string) => void;
  cycles: OkrCycleResponse[];
}

export function CycleSelector({ value, onChange, cycles }: CycleSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select cycle…" />
      </SelectTrigger>
      <SelectContent>
        {cycles.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {c.status === 'CLOSED' && (
              <span className="ml-2 text-xs text-muted-foreground">(Closed)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
