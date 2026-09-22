import React, { createContext, useContext, useState } from "react";
import { I18nManager } from "react-native";
import { translations, Language } from "./translations";

interface I18nContextType {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLang] = useState<Language>("he");

  const setLanguage = (lang: Language) => {
    setLang(lang);
    const shouldBeRTL = lang === "he";
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
  };

  const t = (key: string): string => {
    return translations[language][key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ language, t, setLanguage, isRTL: language === "he" }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
};
