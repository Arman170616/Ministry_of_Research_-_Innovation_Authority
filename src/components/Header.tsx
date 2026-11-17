import { Menu, Search, Bell } from 'lucide-react';
import { LanguageSwitch, useI18n } from '@/lib/i18n';

interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenMobile: () => void;
}

export function Header({ title, subtitle, onOpenMobile }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 md:px-8 py-4">
      <div className="flex items-center gap-4">
        <button onClick={onOpenMobile} className="md:hidden text-ink-200 hover:text-ink-50" aria-label={t('Open menu')}>
          <Menu size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-ink-50">{title}</h1>
          <p className="text-xs md:text-sm text-ink-300">{subtitle}</p>
        </div>
        <div className="hidden md:flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-64">
          <Search size={16} className="text-ink-300" />
          <input
            type="text"
            placeholder={t('Quick search...')}
            className="bg-transparent border-0 outline-none text-sm text-ink-50 placeholder:text-ink-400 flex-1"
          />
        </div>
        <LanguageSwitch className="flex-shrink-0" />
        <button className="relative glass-card rounded-xl p-2.5 hover:bg-slate-50 transition-colors hidden sm:block" aria-label={t('Notifications')}>
          <Bell size={18} className="text-ink-200" />
          <span className="absolute top-2 end-2 w-2 h-2 rounded-full bg-brand" />
        </button>
      </div>
    </header>
  );
}
