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
import { translations, Language } from "./translations";

export interface I18nContextType {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SharedI18nProvider
      translations={translations as any}
      initialLocale="he"
    >
      {children}
    </SharedI18nProvider>
  );
};

export const useI18n = (): I18nContextType => {
  const shared = useSharedI18n();
  return {
    language: shared.locale as Language,
    t: shared.t,
    setLanguage: shared.setLocale as (l: Language) => void,
    isRTL: shared.isRTL,
  };
};
