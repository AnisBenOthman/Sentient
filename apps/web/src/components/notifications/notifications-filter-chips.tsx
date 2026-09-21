import type { NotificationCategory } from "@sentient/shared";
import { useTranslation } from "react-i18next";
import { Toggle } from "@/components/ui/toggle";

// The chip label is translated; `key` is the stable identity used for both
// the React key and the locale lookup.
const CATEGORIES: Array<{ value: NotificationCategory | null; key: "ALL" | "LEAVE" | "PROMOTION" | "PERFORMANCE" | "SKILL" | "SYSTEM" }> = [
  { value: null, key: "ALL" },
  { value: "LEAVE" as NotificationCategory, key: "LEAVE" },
  { value: "PROMOTION" as NotificationCategory, key: "PROMOTION" },
  { value: "PERFORMANCE" as NotificationCategory, key: "PERFORMANCE" },
  { value: "SKILL" as NotificationCategory, key: "SKILL" },
  { value: "SYSTEM" as NotificationCategory, key: "SYSTEM" },
];

export function NotificationsFilterChips({
  value,
  onChange,
}: {
  value: NotificationCategory | null;
  onChange: (value: NotificationCategory | null) => void;
}) {
  const { t } = useTranslation("notifications");
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {CATEGORIES.map((category) => (
        <Toggle
          key={category.key}
          size="sm"
          variant="outline"
          pressed={value === category.value}
          onPressedChange={() => onChange(category.value)}
          className="h-7 shrink-0 px-2 text-xs"
        >
          {t(`categories.${category.key}` as "categories.ALL")}
        </Toggle>
      ))}
    </div>
  );
}
