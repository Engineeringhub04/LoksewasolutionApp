// Centralized localization (PRD §6). All user-facing UI text must be looked up
// via useTranslation()/t() — never hardcode strings directly in screens.
import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import ne from './ne.json';
import { AppConfig } from '@/src/core/config/appConfig';

export type Language = 'en' | 'ne';

const dictionaries: Record<Language, typeof en> = { en, ne };

const STORAGE_KEY = 'loksewa:language';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface I18nCtx {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslateFn;
  ready: boolean;
}

const Ctx = createContext<I18nCtx | undefined>(undefined);

function resolveKey(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    const value = params[token];
    return value !== undefined ? String(value) : match;
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(AppConfig.localization.defaultLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'ne') setLanguageState(stored);
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const dict = dictionaries[language] as unknown as Record<string, unknown>;
      const fallbackDict = dictionaries.en as unknown as Record<string, unknown>;
      const value = resolveKey(dict, key) ?? resolveKey(fallbackDict, key) ?? key;
      return interpolate(value, params);
    },
    [language]
  );

  const value = useMemo<I18nCtx>(() => ({ language, setLanguage, t, ready }), [language, setLanguage, t, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTranslation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
