import type { NotificationCategory } from "@sentient/shared";
import { Toggle } from "@/components/ui/toggle";

const CATEGORIES: Array<{ value: NotificationCategory | null; label: string }> = [
  { value: null, label: "All" },
  { value: "LEAVE" as NotificationCategory, label: "Leave" },
  { value: "PROMOTION" as NotificationCategory, label: "Promotion" },
  { value: "PERFORMANCE" as NotificationCategory, label: "Performance" },
  { value: "SKILL" as NotificationCategory, label: "Skills" },
  { value: "SYSTEM" as NotificationCategory, label: "System" },
];

export function NotificationsFilterChips({
  value,
  onChange,
}: {
  value: NotificationCategory | null;
  onChange: (value: NotificationCategory | null) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {CATEGORIES.map((category) => (
        <Toggle
          key={category.label}
          size="sm"
          variant="outline"
          pressed={value === category.value}
          onPressedChange={() => onChange(category.value)}
          className="h-7 shrink-0 px-2 text-xs"
        >
          {category.label}
        </Toggle>
      ))}
    </div>
  );
}
