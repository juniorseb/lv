import { useEffect, useState, type ReactNode } from 'react';

import { adminApi, authApi, getToken, setToken } from './api';
import DriversPage from './pages/DriversPage';
import LoginPage from './pages/LoginPage';
import SosPage from './pages/SosPage';
import StatsPage from './pages/StatsPage';
import VerificationsPage from './pages/VerificationsPage';
import { AdminUser } from './types';

type Tab = 'stats' | 'drivers' | 'verifications' | 'sos';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'out' | 'in'>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<Tab>('stats');
  const [sosCount, setSosCount] = useState(0);

  // Restaure la session si un jeton admin valide est déjà présent.
  useEffect(() => {
    if (!getToken()) {
      setStatus('out');
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (me.isAdmin) {
          setUser(me);
          setStatus('in');
        } else {
          setToken(null);
          setStatus('out');
        }
      })
      .catch(() => {
        setToken(null);
        setStatus('out');
      });
  }, []);

  // Suivi du nombre d'alertes SOS actives (badge onglet), pendant la session.
  useEffect(() => {
    if (status !== 'in') return;
    const poll = () =>
      adminApi
        .sos()
        .then((list) => setSosCount(list.length))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [status]);

  const logout = () => {
    setToken(null);
    setUser(null);
    setStatus('out');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }

  if (status === 'out' || !user) {
    return (
      <LoginPage
        onAuthenticated={(me) => {
          setUser(me);
          setStatus('in');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold text-orange">Livrechap</span>
            <nav className="flex gap-1">
              <TabButton active={tab === 'stats'} onClick={() => setTab('stats')}>
                Statistiques
              </TabButton>
              <TabButton
                active={tab === 'drivers'}
                onClick={() => setTab('drivers')}
              >
                Livreurs
              </TabButton>
              <TabButton
                active={tab === 'verifications'}
                onClick={() => setTab('verifications')}
              >
                Pièces d'identité
              </TabButton>
              <TabButton active={tab === 'sos'} onClick={() => setTab('sos')}>
                <span className="flex items-center gap-1.5">
                  SOS
                  {sosCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                      {sosCount}
                    </span>
                  )}
                </span>
              </TabButton>
            </nav>
          </div>
          <button className="text-sm text-slate-500" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'stats' ? (
          <StatsPage />
        ) : tab === 'drivers' ? (
          <DriversPage />
        ) : tab === 'sos' ? (
          <SosPage />
        ) : (
          <VerificationsPage />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
        active ? 'bg-orange text-white' : 'text-navy hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
