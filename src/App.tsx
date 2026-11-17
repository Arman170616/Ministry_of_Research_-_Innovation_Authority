import { useState, useEffect } from 'react';
import { LiquidBackground } from '@/components/ui';
import { Sidebar, type View } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/views/Dashboard';
import { Proposals } from '@/views/Proposals';
import { Publications } from '@/views/Publications';
import { Matching } from '@/views/Matching';
import { Login } from '@/views/Login';
import { useProposals, usePublications, useMatches } from '@/lib/hooks';
import { auth, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Research Dashboard', subtitle: 'Overview of proposals, publications, and matching activity' },
  proposals: { title: 'Research Proposals', subtitle: 'Upload and filter funding proposals for review' },
  publications: { title: 'Publications Library', subtitle: 'Published research papers for matching reference' },
  matching: { title: 'Proposal Matching', subtitle: 'Filter proposals by publication matching score' },
};

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <LiquidBackground />
      <div className="relative z-10 text-ink-300 text-sm">{children}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));

    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const handleSignOut = async () => {
    await auth.logout();
    setUser(null);
  };

  if (!authReady) return <FullScreenMessage><LoadingText /></FullScreenMessage>;
  if (!user) return <Login onAuthed={setUser} />;

  // Keyed by user so nothing from a previous session's data survives a sign-in as someone else.
  return <Workspace key={user.id} user={user} onSignOut={handleSignOut} />;
}

function LoadingText() {
  const { t } = useI18n();
  return <>{t('Loading...')}</>;
}

function Workspace({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const { proposals, loading: proposalsLoading } = useProposals();
  const { publications, loading: publicationsLoading } = usePublications();
  const { matches, loading: matchesLoading } = useMatches();

  const loading = proposalsLoading || publicationsLoading || matchesLoading;
  const meta = VIEW_META[view];

  return (
    <div className="relative min-h-screen">
      <LiquidBackground />

      <div className="relative z-10 flex">
        <Sidebar
          current={view}
          onNavigate={setView}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          userEmail={user.email || user.username}
          onSignOut={onSignOut}
        />

        <div className="flex-1 min-w-0">
          <Header
            title={t(meta.title)}
            subtitle={t(meta.subtitle)}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <main className="p-4 md:p-8 max-w-7xl mx-auto">
            {loading ? (
              <div className="glass-card rounded-2xl p-12 text-center text-ink-300">{t('Loading data...')}</div>
            ) : (
              <>
                {view === 'dashboard' && <Dashboard proposals={proposals} publications={publications} matches={matches} />}
                {view === 'proposals' && <Proposals />}
                {view === 'publications' && <Publications />}
                {view === 'matching' && <Matching />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
