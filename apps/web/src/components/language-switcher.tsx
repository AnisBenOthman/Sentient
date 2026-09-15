import { useTranslation } from "react-i18next";

import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  collapsed: boolean;
}

// Fixed abbreviations, not translated strings — "EN"/"FR" read the same in either language.
const LANGUAGE_SHORT: Record<SupportedLanguage, string> = {
  en: "EN",
  fr: "FR",
};

/**
 * WHY: A sliding segmented toggle rather than a single cycle-button — both
 * languages are visible and tappable at once, so switching is a single
 * targeted click instead of "click, check, maybe click again." The thumb's
 * position is itself the current-language indicator, no separate label needed.
 */
export function LanguageSwitcher({ collapsed }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation("nav");

  const current: SupportedLanguage = isSupportedLanguage(i18n.language)
    ? i18n.language
    : "en";

  function switchTo(lang: SupportedLanguage) {
    if (lang !== current) void i18n.changeLanguage(lang);
  }

  if (collapsed) {
    const next: SupportedLanguage = current === "en" ? "fr" : "en";
    return (
      <button
        onClick={() => switchTo(next)}
        className={cn(
          "flex items-center justify-center w-full py-1.5 rounded-md transition-colors",
          "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
          "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
        )}
        aria-label={t("switchLanguage")}
        lang={next}
        data-testid="button-language-switcher"
        data-tour="language-switcher"
        title={t("switchLanguage")}
      >
        <span className="text-[10px] font-bold tracking-wider tabular-nums">
          {LANGUAGE_SHORT[current]}
        </span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("switchLanguage")}
      data-testid="button-language-switcher"
      data-tour="language-switcher"
      className="relative flex w-full rounded-full bg-gray-100 p-[3px] dark:bg-gray-800"
    >
      {/* Sliding thumb — translateX(100%) rides on its own box width, so it
          lands exactly on the second slot regardless of container width. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full",
          "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]",
          "dark:bg-gray-700 dark:ring-white/[0.06]",
          "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        )}
        style={{
          transform: current === "fr" ? "translateX(100%)" : "translateX(0%)",
        }}
      />
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = current === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => switchTo(lang)}
            aria-pressed={isActive}
            lang={lang}
            data-testid={`button-language-${lang}`}
            title={LANGUAGE_LABELS[lang]}
            className={cn(
              "relative z-10 flex-1 rounded-full py-1 text-[11px] font-semibold tracking-wide transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
              isActive
                ? "text-gray-900 dark:text-gray-50"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
            )}
          >
            {LANGUAGE_SHORT[lang]}
          </button>
        );
      })}
    </div>
  );
}
