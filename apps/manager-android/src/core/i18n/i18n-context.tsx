/**
 * [PHASE 18 MIGRATION SHIM]
 * Connected to @restaurantos/shared-mobile I18nProvider with native RTL enforcement.
 */

import React from "react";
import {
  I18nProvider as SharedI18nProvider,
  useI18n as useSharedI18n,
  SupportedLocale,
} from "@restaurantos/shared-mobile";
import { translations, Locale } from "./translations";

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.he) => string;
  isRTL: boolean;
  dir: "rtl" | "ltr";
}

export const I18nProvider: React.FC<{
  children: React.ReactNode;
  initialLocale?: Locale;
}> = ({ children, initialLocale = "he" }) => {
  return (
    <SharedI18nProvider
      translations={translations as any}
      initialLocale={initialLocale as SupportedLocale}
    >
      {children}
    </SharedI18nProvider>
  );
};

export const useI18n = (): I18nContextType => {
  const shared = useSharedI18n();
  return {
    locale: shared.locale as Locale,
    setLocale: shared.setLocale as (l: Locale) => void,
    t: shared.t as (k: keyof typeof translations.he) => string,
    isRTL: shared.isRTL,
    dir: shared.dir,
  };
};
