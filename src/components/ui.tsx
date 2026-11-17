import { useEffect, useState } from 'react';

export function LiquidBackground() {
  return (
    <div className="liquid-bg">
      <div className="liquid-blob blob-1" />
      <div className="liquid-blob blob-2" />
      <div className="liquid-blob blob-3" />
      <div className="liquid-blob blob-4" />
    </div>
  );
}

export function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#0d9488' : score >= 50 ? '#0891b2' : score >= 30 ? '#d97706' : '#e11d48';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="score-ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(30,58,95,0.1)" strokeWidth={stroke} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong relative z-10 w-full max-w-2xl rounded-3xl p-6 slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-50">{title}</h2>
          <button onClick={onClose} className="text-ink-200 hover:text-ink-50 transition-colors text-2xl leading-none">
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
    <div className="fixed bottom-6 right-6 z-50 slide-up">
      <div className={`glass-strong rounded-2xl px-5 py-3 flex items-center gap-3 ${type === 'success' ? 'border-teal-400/30' : 'border-rose-400/30'}`}>
        <div className={`w-2 h-2 rounded-full ${type === 'success' ? 'bg-teal-glow' : 'bg-rose-500'}`} />
        <span className="text-sm text-ink-50">{message}</span>
      </div>
    </div>
  );
}
