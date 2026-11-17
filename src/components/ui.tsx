import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

/** Page background: warm off-white with the faint Omani lattice used on the login page. */
export function LiquidBackground() {
  return (
    <div className="liquid-bg" aria-hidden>
      <svg className="absolute inset-0 h-full w-full text-brand opacity-[0.035]">
        <defs>
          <pattern id="app-lattice" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M28 0 L56 28 L28 56 L0 28 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M28 14 L42 28 L28 42 L14 28 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="28" cy="28" r="2" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#app-lattice)" />
      </svg>
    </div>
  );
}

export function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#475569' : score >= 30 ? '#d97706' : '#c8102e';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="score-ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color }}>
        {Math.round(score)}%
      </span>
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  const { t } = useI18n();
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="glass-strong relative z-10 w-full max-w-2xl rounded-3xl p-6 slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-50">{title}</h2>
          <button onClick={onClose} className="text-ink-200 hover:text-ink-50 transition-colors text-2xl leading-none" aria-label={t('Close')}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 end-6 z-50 slide-up">
      <div className={`glass-strong rounded-2xl px-5 py-3 flex items-center gap-3 ${type === 'success' ? 'border-emerald-300' : 'border-brand-200'}`}>
        <div className={`w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-500' : 'bg-brand'}`} />
        <span className="text-sm text-ink-50">{message}</span>
      </div>
    </div>
  );
}
