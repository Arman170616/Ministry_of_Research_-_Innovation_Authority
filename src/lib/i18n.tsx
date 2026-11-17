/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AR } from '@/lib/i18n-ar';

/**
 * English / Arabic support.
 *
 * Strings are written in English in the components and wrapped in t('...').
 * The English text is the key: Arabic comes from the dictionary in i18n-ar.ts,
 * and anything missing falls back to English (and is reported in the dev console).
 * Placeholders use {name}: t('{count} proposals found', { count: 3 }).
 */
export type Lang = 'en' | 'ar';
type Vars = Record<string, string | number>;

const STORAGE_KEY = 'ria.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch { /* storage unavailable */ }
  return 'en';
}

// Module-level copy so plain helpers (formatDate, formatCurrency...) can read the language.
let currentLang: Lang = initialLang();

export function getLang(): Lang {
  return currentLang;
}

/** Locale for Intl formatting. Arabic keeps Western digits, as common on Omani government sites. */
export function locale(lang: Lang = currentLang): string {
  return lang === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB';
}

const reportedMissing = new Set<string>();

export function translate(text: string, vars?: Vars, lang: Lang = currentLang): string {
  let out = text;
  if (lang === 'ar') {
    const ar = AR[text];
    if (ar !== undefined) out = ar;
    else if (import.meta.env.DEV && text.trim() && !reportedMissing.has(text)) {
      reportedMissing.add(text);
      console.warn(`[i18n] missing Arabic translation: "${text}"`);
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = translate('Research Portal — Research and Innovation Authority', undefined, lang);
}

interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  t: (text: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  useEffect(() => { applyToDocument(lang); }, [lang]);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(() => ({
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    isRTL: lang === 'ar',
    setLang,
    t: (text, vars) => translate(text, vars, lang),
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Two-button English / العربية switch. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold ${className}`} role="group" aria-label={t('Language')}>
      {(['en', 'ar'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          lang={l}
          className={`rounded-lg px-2.5 py-1.5 transition-colors ${lang === l ? 'bg-brand text-white' : 'text-ink-300 hover:text-ink-50'}`}
        >
          {l === 'en' ? 'English' : 'العربية'}
        </button>
      ))}
    </div>
  );
}
