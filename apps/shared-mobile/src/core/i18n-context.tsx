import React, { createContext, useContext, useState, useMemo } from "react";
import { I18nManager } from "react-native";

export type SupportedLocale = "he" | "en";

export interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string) => string;
  isRTL: boolean;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  translations: Record<SupportedLocale, Record<string, string>>;
  initialLocale?: SupportedLocale;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  translations,
  initialLocale = "he",
}) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    const shouldBeRTL = newLocale === "he";
    if (I18nManager.isRTL !== shouldBeRTL) {
      try {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      } catch (err) {
        console.warn("Could not set I18nManager RTL state:", err);
      }
    }
  };

  const isRTL = locale === "he";
  const dir = isRTL ? "rtl" : "ltr";

  const t = useMemo(() => {
    return (key: string): string => {
      const dict = translations[locale] || translations.he;
      return dict?.[key] || translations.he?.[key] || key;
    };
  }, [locale, translations]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isRTL, dir }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
