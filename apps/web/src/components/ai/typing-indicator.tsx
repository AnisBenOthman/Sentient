import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Three staggered bouncing dots — the "thinking" state shown before a response starts typing. */
export function TypingIndicator({ className }: { className?: string }) {
  const { t } = useTranslation("ai");
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="status"
      aria-label={t("typing")}
    >
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}
