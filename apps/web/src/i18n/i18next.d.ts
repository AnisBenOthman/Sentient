import "i18next";

import type { AppResources } from "./index";

/**
 * WHY: Augmenting CustomTypeOptions makes `t()` keys checked against the actual
 * EN locale files. A typo like t("commmon.save") becomes a tsc error rather
 * than a string that renders the raw key to the user in production.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: AppResources;
    returnNull: false;
  }
}
