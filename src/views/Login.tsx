import { useState } from 'react';
import {
  User, Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, ArrowRight,
  FileInput, GitCompareArrows, ClipboardCheck,
} from 'lucide-react';
import { auth } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import { LanguageSwitch, useI18n } from '@/lib/i18n';

const LOGO_SRC = '/images/ria-logo.png';

const STEPS = [
  { icon: FileInput, title: 'Intake', text: 'Submit and filter funding proposals in one place.' },
  { icon: GitCompareArrows, title: 'Match', text: 'Compare proposals against the national publication record.' },
  { icon: ClipboardCheck, title: 'Evaluate', text: 'Score across three themes aligned with Oman Vision 2040.' },
];

/** Subtle geometric pattern inspired by traditional Omani lattice work. */
function LatticePattern() {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full text-[#c8102e] opacity-[0.05]">
      <defs>
        <pattern id="ria-lattice" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M28 0 L56 28 L28 56 L0 28 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M28 14 L42 28 L28 42 L14 28 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="28" cy="28" r="2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ria-lattice)" />
    </svg>
  );
}

export function Login({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin' && (!username || !password)) {
      setError(t('Please enter your username and password.'));
      return;
    }
    if (mode === 'signup' && (!email || !password)) {
      setError(t('Please enter your email and password.'));
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // A plain username also matches an account registered as <username>@ria.gov.om (handled by the API).
      const user = mode === 'signin'
        ? await auth.login(username, password)
        : await auth.register(email, password);
      onAuthed(user);
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setError(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const fieldWrap =
    'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition ' +
    'focus-within:border-[#c8102e] focus-within:ring-4 focus-within:ring-[#c8102e]/10';
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600';

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {/* ── Brand panel (desktop) ── */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-slate-200 bg-[#faf7f5] p-12 lg:flex xl:p-16">
        <LatticePattern />
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#c8102e]" />

        <div className="relative">
          <img src={LOGO_SRC} alt={t('Research and Innovation Authority')} className="h-20 w-auto mix-blend-multiply xl:h-24" />
        </div>

        <div className="relative max-w-lg">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">{t('Research Portal')}</p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 xl:text-[2.75rem]">
            {t('Research Proposal Matching Platform')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {t('A single workspace for reviewing national research funding proposals — from submission through matching to final evaluation.')}
          </p>

          <ol className="mt-10 space-y-5">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#c8102e] shadow-sm ring-1 ring-slate-200">
                  <Icon size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="me-2 text-slate-400">0{i + 1}</span>{t(title)}
                  </p>
                  <p className="text-sm text-slate-600">{t(text)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} {t('Research and Innovation Authority · Sultanate of Oman')}
        </p>
      </aside>

      {/* ── Form panel ── */}
      <main className="relative flex flex-1 flex-col">
        <div className="h-1.5 bg-[#c8102e] lg:hidden" />
        <div className="flex justify-end px-4 pt-4 sm:px-8">
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[420px] slide-up">
            {/* Mobile logo */}
            <img src={LOGO_SRC} alt={t('Research and Innovation Authority')} className="mx-auto mb-10 h-16 w-auto lg:hidden" />

            <h2 className="text-3xl font-bold text-slate-900">
              {mode === 'signin' ? t('Welcome back') : t('Create your account')}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {mode === 'signin'
                ? t('Sign in with your authority credentials to continue.')
                : t('Register with your email to access the research portal.')}
            </p>

            {/* Mode toggle */}
            <div className="mt-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                    mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m === 'signin' ? t('Sign in') : t('Sign up')}
                </button>
              ))}
            </div>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {mode === 'signin' ? (
                <div>
                  <label htmlFor="username" className={labelCls}>{t('Username')}</label>
                  <div className={fieldWrap}>
                    <User size={18} className="flex-shrink-0 text-slate-400" />
                    <input
                      id="username"
                      dir="auto"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('Enter your username')}
                      autoComplete="username"
                      className="flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="email" className={labelCls}>{t('Email')}</label>
                  <div className={fieldWrap}>
                    <Mail size={18} className="flex-shrink-0 text-slate-400" />
                    <input
                      id="email"
                      dir="auto"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="password" className={labelCls}>{t('Password')}</label>
                <div className={fieldWrap}>
                  <Lock size={18} className="flex-shrink-0 text-slate-400" />
                  <input
                    id="password"
                      dir="auto"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? t('Choose a password') : t('Enter your password')}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('Hide password') : t('Show password')}
                    className="flex-shrink-0 text-slate-400 transition hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#c8102e] py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a50d26] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c8102e]/25 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {mode === 'signin' ? t('Sign in') : t('Create account')}
                    <ArrowRight size={16} className="transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              {mode === 'signin' ? t("Don't have an account?") : t('Already have an account?')}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-semibold text-[#c8102e] hover:underline"
              >
                {mode === 'signin' ? t('Sign up') : t('Sign in')}
              </button>
            </p>
          </div>
        </div>

        <p className="pb-6 text-center text-xs text-slate-400 lg:hidden">
          © {new Date().getFullYear()} {t('Research and Innovation Authority · Sultanate of Oman')}
        </p>
      </main>
    </div>
  );
}
