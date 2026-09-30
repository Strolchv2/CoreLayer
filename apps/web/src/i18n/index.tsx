import type { Locale } from '@cv-studio/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { messages, type MessageKey } from './messages';

export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const STORAGE_KEY = 'cvs.locale';
const I18nContext = createContext<I18nContextValue | null>(null);

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    /* localStorage nicht verfügbar */
  }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : navigator.language ? 'en' : 'de';
}

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignorieren */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<Translate>(
    (key, vars) => {
      const dict = messages[locale] as Record<string, string>;
      const value = dict[key] ?? (messages.de as Record<string, string>)[key];
      if (value === undefined) {
        if (import.meta.env.DEV) console.warn(`Fehlende Übersetzung: ${key}`);
        return key;
      }
      return interpolate(value, vars);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n außerhalb des I18nProvider');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}

export type { MessageKey };
