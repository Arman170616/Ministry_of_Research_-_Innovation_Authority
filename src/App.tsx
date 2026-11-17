import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { LiquidBackground } from '@/components/ui';
import { Sidebar, type View } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/views/Dashboard';
import { Proposals } from '@/views/Proposals';
import { Publications } from '@/views/Publications';
import { Matching } from '@/views/Matching';
import { Login } from '@/views/Login';
import { useProposals, usePublications, useMatches } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Research Dashboard', subtitle: 'Overview of proposals, publications, and matching activity' },
  proposals: { title: 'Research Proposals', subtitle: 'Upload and filter funding proposals for review' },
  publications: { title: 'Publications Library', subtitle: 'Published research papers for matching reference' },
  matching: { title: 'Proposal Matching', subtitle: 'Filter proposals by publication matching score' },
};

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const { proposals, loading: proposalsLoading } = useProposals();
  const { publications, loading: publicationsLoading } = usePublications();
  const { matches, loading: matchesLoading } = useMatches();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView('dashboard');
  };

  if (!authReady) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <LiquidBackground />
        <div className="relative z-10 text-ink-300 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onAuthed={() => {}} />;
  }

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
          userEmail={user.email ?? ''}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 min-w-0">
          <Header
            title={meta.title}
            subtitle={meta.subtitle}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <main className="p-4 md:p-8 max-w-7xl mx-auto">
            {loading ? (
              <div className="glass-card rounded-2xl p-12 text-center text-ink-300">Loading data...</div>
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
