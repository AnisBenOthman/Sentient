import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enAi from "./locales/en/ai.json";
import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import enEmployees from "./locales/en/employees.json";
import enErrors from "./locales/en/errors.json";
import enHome from "./locales/en/home.json";
import enLeaveManagement from "./locales/en/leave-management.json";
import enLeaves from "./locales/en/leaves.json";
import enNav from "./locales/en/nav.json";
import enNotifications from "./locales/en/notifications.json";
import enOkr from "./locales/en/okr.json";
import enOrgChart from "./locales/en/org-chart.json";
import enPerformance from "./locales/en/performance.json";
import enPositions from "./locales/en/positions.json";
import enRecruitment from "./locales/en/recruitment.json";
import enSettings from "./locales/en/settings.json";
import enSimulation from "./locales/en/simulation.json";
import enSocial from "./locales/en/social.json";
import enTour from "./locales/en/tour.json";

import frAi from "./locales/fr/ai.json";
import frAuth from "./locales/fr/auth.json";
import frCommon from "./locales/fr/common.json";
import frDashboard from "./locales/fr/dashboard.json";
import frEmployees from "./locales/fr/employees.json";
import frErrors from "./locales/fr/errors.json";
import frHome from "./locales/fr/home.json";
import frLeaveManagement from "./locales/fr/leave-management.json";
import frLeaves from "./locales/fr/leaves.json";
import frNav from "./locales/fr/nav.json";
import frNotifications from "./locales/fr/notifications.json";
import frOkr from "./locales/fr/okr.json";
import frOrgChart from "./locales/fr/org-chart.json";
import frPerformance from "./locales/fr/performance.json";
import frPositions from "./locales/fr/positions.json";
import frRecruitment from "./locales/fr/recruitment.json";
import frSettings from "./locales/fr/settings.json";
import frSimulation from "./locales/fr/simulation.json";
import frSocial from "./locales/fr/social.json";
import frTour from "./locales/fr/tour.json";

/**
 * WHY: Locales are bundled statically rather than fetched over HTTP.
 * The full FR+EN payload is ~30 small JSON files; a network round-trip per
 * namespace would flash untranslated text on every route change, and the
 * app is already behind an auth wall where lazy-loading buys nothing.
 */
export const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "sentient.language";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
};

const resources = {
  en: {
    ai: enAi,
    auth: enAuth,
    common: enCommon,
    dashboard: enDashboard,
    employees: enEmployees,
    errors: enErrors,
    home: enHome,
    "leave-management": enLeaveManagement,
    leaves: enLeaves,
    nav: enNav,
    notifications: enNotifications,
    okr: enOkr,
    "org-chart": enOrgChart,
    performance: enPerformance,
    positions: enPositions,
    recruitment: enRecruitment,
    settings: enSettings,
    simulation: enSimulation,
    social: enSocial,
    tour: enTour,
  },
  fr: {
    ai: frAi,
    auth: frAuth,
    common: frCommon,
    dashboard: frDashboard,
    employees: frEmployees,
    errors: frErrors,
    home: frHome,
    "leave-management": frLeaveManagement,
    leaves: frLeaves,
    nav: frNav,
    notifications: frNotifications,
    okr: frOkr,
    "org-chart": frOrgChart,
    performance: frPerformance,
    positions: frPositions,
    recruitment: frRecruitment,
    settings: frSettings,
    simulation: frSimulation,
    social: frSocial,
    tour: frTour,
  },
} as const;

/**
 * WHY: EN is the reference shape for key typing. FR is asserted to match it
 * structurally at build time via the `frResourcesMatchEn` check below, so a key
 * added to one locale but not the other fails `tsc` instead of silently
 * falling back to English at runtime.
 */
export type AppResources = (typeof resources)["en"];

// Compile-time EN/FR parity guard — no runtime cost, fails `tsc --noEmit` on drift.
// Depth-bounded to 3 levels (deepest real key is home.json's `links.dashboard.title`).
// Unbounded recursion across 15 namespaces exceeds TS's instantiation limit, so the
// depth is fixed rather than generic — raise it if a locale ever nests deeper.
type KeysLvl1<T> = {
  [K in keyof T]: T[K] extends string ? K & string : never;
}[keyof T];

type KeysLvl2<T> = {
  [K in keyof T]: T[K] extends string
    ? K & string
    : `${K & string}.${KeysLvl1<T[K]> & string}`
      | `${K & string}.${KeysLvl2Nested<T[K]> & string}`;
}[keyof T];

type KeysLvl2Nested<T> = {
  [K in keyof T]: T[K] extends string
    ? never
    : `${K & string}.${keyof T[K] & string}`;
}[keyof T];

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * If this errors, EN and FR have diverged — one locale has a key the other
 * lacks. Hovering the error shows which key set is unmatched.
 */
const frResourcesMatchEn: Equals<
  { [N in keyof AppResources]: KeysLvl2<AppResources[N]> },
  { [N in keyof (typeof resources)["fr"]]: KeysLvl2<(typeof resources)["fr"][N]> }
> = true;
void frResourcesMatchEn;

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

/**
 * WHY: Hand-rolled instead of i18next-browser-languagedetector — the whole
 * detector is three ordered sources for us (explicit choice, browser, default),
 * which is cheaper to read here than a dependency plus its config block.
 */
function detectInitialLanguage(): SupportedLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage can throw in private-mode / sandboxed contexts — fall through.
  }

  // navigator.language is a BCP-47 tag ("fr-FR"); we only key off the primary subtag.
  const browserPrimary = navigator.language?.split("-")[0]?.toLowerCase();
  if (isSupportedLanguage(browserPrimary)) return browserPrimary;

  return "en";
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: "common",
  ns: Object.keys(resources.en),
  interpolation: {
    // React already escapes interpolated values before they reach the DOM.
    escapeValue: false,
  },
});

/**
 * WHY: `lang` on <html> is what screen readers use to pick a pronunciation
 * dictionary and what suppresses the browser's "translate this page?" prompt.
 * i18next does not touch the DOM, so we sync it ourselves.
 */
function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = isSupportedLanguage(language)
    ? language
    : "en";
}

syncDocumentLanguage(i18n.language);

i18n.on("languageChanged", (language: string) => {
  syncDocumentLanguage(language);
  try {
    if (isSupportedLanguage(language)) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  } catch {
    // Persistence is best-effort; an in-memory switch still works this session.
  }
});

export default i18n;
