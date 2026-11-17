import { LayoutDashboard, FileText, BookOpen, GitCompare, FlaskConical, X, LogOut, type LucideIcon } from 'lucide-react';

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
      {mobileOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={onCloseMobile} />}

      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 z-40 md:z-0 flex flex-col glass border-r border-white/40 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-ink-700/15">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <FlaskConical size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-ink-50 leading-tight">Research & Innovation Authority</h1>
            <p className="text-[11px] text-ink-300">Ministry of Oman</p>
          </div>
          <button onClick={onCloseMobile} className="ml-auto md:hidden text-ink-200">
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'glass-strong text-teal-glow border-teal-400/30'
                    : 'text-ink-200 hover:text-ink-50 hover:bg-white/30'
                }`}
              >
                <Icon size={18} className={active ? 'text-teal-glow' : 'text-ink-300'} />
                {item.label}
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-glow animate-pulse" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-700/15 space-y-3">
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-100 font-medium truncate">{userEmail}</p>
              <p className="text-[10px] text-ink-400">Signed in</p>
            </div>
            <button onClick={onSignOut} className="glass rounded-lg p-1.5 hover:bg-white/30 transition-colors" title="Sign out">
              <LogOut size={14} className="text-ink-200" />
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
