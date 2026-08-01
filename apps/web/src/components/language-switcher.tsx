import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  LANGUAGE_LABELS,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  collapsed: boolean;
}

/**
 * WHY: A two-language toggle rather than a dropdown — with exactly EN and FR
 * a select adds a click and a popover layer for no gain. Mirrors the adjacent
 * dark-mode button so the sidebar footer reads as one control group.
 */
export function LanguageSwitcher({ collapsed }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation("nav");

  const current: SupportedLanguage = isSupportedLanguage(i18n.language)
    ? i18n.language
    : "en";
  const next: SupportedLanguage = current === "en" ? "fr" : "en";

  // nav.json defines switchLanguage per-locale as the *target* language label,
  // so the button always advertises what you get, not what you have.
  const label = t("switchLanguage");

  return (
    <button
      onClick={() => void i18n.changeLanguage(next)}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm w-full transition-colors",
        "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
        collapsed && "justify-center px-0",
      )}
      aria-label={label}
      lang={next}
      data-testid="button-language-switcher"
      data-tour="language-switcher"
      title={collapsed ? label : undefined}
    >
      <Languages className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {!collapsed && (
        <span className="text-xs">{LANGUAGE_LABELS[next]}</span>
      )}
    </button>
  );
}
