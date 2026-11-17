import { LayoutDashboard, FileText, BookOpen, GitCompare, X, LogOut, type LucideIcon } from 'lucide-react';

export type View = 'dashboard' | 'proposals' | 'publications' | 'matching';

interface SidebarProps {
  current: View;
  onNavigate: (view: View) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userEmail: string;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'publications', label: 'Publications', icon: BookOpen },
  { id: 'matching', label: 'Matching', icon: GitCompare },
];

export function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile, userEmail, onSignOut }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/30 z-30 md:hidden" onClick={onCloseMobile} />}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 z-40 md:z-0 flex flex-col bg-white border-r border-slate-200 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-1 bg-brand flex-shrink-0" />

        {/* Logo */}
        <div className="relative px-5 pt-6 pb-5 border-b border-slate-200">
          <img src="/images/ria-logo.png" alt="Research and Innovation Authority" className="h-11 w-auto" />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Research Portal</p>
          <button onClick={onCloseMobile} className="absolute right-3 top-5 md:hidden text-ink-300 hover:text-ink-50" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand'
                    : 'text-ink-300 hover:text-ink-50 hover:bg-slate-100'
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand" />}
                <Icon size={18} className={active ? 'text-brand' : 'text-ink-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-700/15 space-y-3">
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-100 font-medium truncate">{userEmail}</p>
              <p className="text-[10px] text-ink-400">Signed in</p>
            </div>
            <button onClick={onSignOut} className="rounded-lg p-1.5 text-ink-400 hover:text-brand hover:bg-brand-50 transition-colors" title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
          <div className="glass-card rounded-xl p-3">
            <p className="text-[10px] text-ink-300 uppercase tracking-wider mb-1">Powered by</p>
            <p className="text-xs text-ink-100 font-medium">Sultanate of Oman</p>
            <p className="text-[10px] text-ink-400">Research Proposal Management Platform</p>
          </div>
        </div>
      </aside>
    </>
  );
}
