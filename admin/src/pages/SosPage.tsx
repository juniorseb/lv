import { useEffect, useState } from 'react';

import { adminApi } from '../api';
import { AdminSosAlert } from '../types';

// Livrechap Protect — alertes SOS actives (support). Rafraîchi automatiquement :
// une alerte est urgente, la liste doit refléter la position live sans action.
export default function SosPage() {
  const [alerts, setAlerts] = useState<AdminSosAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    adminApi
      .sos()
      .then(setAlerts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur.'));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const resolve = async (id: string) => {
    setBusyId(id);
    try {
      await adminApi.resolveSos(id);
      setAlerts((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!alerts) return <p className="text-slate-500">Chargement…</p>;
  if (alerts.length === 0)
    return (
      <p className="text-slate-500">
        Aucune alerte SOS active. Tout est calme. 🟢
      </p>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {alerts.length} alerte{alerts.length > 1 ? 's' : ''} active
        {alerts.length > 1 ? 's' : ''} · actualisé toutes les 10 s
      </p>
      {alerts.map((a) => (
        <div
          key={a.id}
          className="bg-red-50 border-2 border-red-400 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <p className="font-bold text-red-700">
                SOS · {a.role === 'livreur' ? 'Livreur' : 'Client'}
              </p>
            </div>
            <p className="font-semibold text-navy mt-1">
              {a.userName ?? 'Sans nom'}
            </p>
            <p className="text-sm text-slate-600">
              <a className="text-orange underline" href={`tel:${a.userPhone}`}>
                {a.userPhone}
              </a>
              {a.deliveryId ? ' · livraison en cours' : ' · tournée'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Déclenché à {formatTime(a.createdAt)}
              {a.locationUpdatedAt
                ? ` · position màj ${formatTime(a.locationUpdatedAt)}`
                : ' · position initiale'}
            </p>
            <a
              className="text-orange underline text-sm"
              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              📍 Voir la position ({a.latitude.toFixed(5)},{' '}
              {a.longitude.toFixed(5)})
            </a>
          </div>
          <button
            className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-50"
            onClick={() => resolve(a.id)}
            disabled={busyId === a.id}
          >
            Marquer résolue
          </button>
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
