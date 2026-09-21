import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { translations, Locale } from "./translations";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.he) => string;
  isRTL: boolean;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLocale?: Locale }> = ({
  children,
  initialLocale = "he",
}) => {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const isRTL = locale === "he";
  const dir = isRTL ? "rtl" : "ltr";

  const t = useMemo(() => {
    return (key: keyof typeof translations.he): string => {
      const dict = translations[locale] || translations.he;
      return dict[key] || translations.he[key] || (key as string);
    };
  }, [locale]);

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
