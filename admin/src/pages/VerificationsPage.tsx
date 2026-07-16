import { useEffect, useState } from 'react';

import { adminApi } from '../api';
import { PendingUser } from '../types';

// Validation par palier (dossier §6) : revue manuelle des CNI soumises.
export default function VerificationsPage() {
  const [users, setUsers] = useState<PendingUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    adminApi
      .pending()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur.'));
  };

  useEffect(load, []);

  const act = async (id: string, action: 'verify' | 'reject') => {
    setBusyId(id);
    try {
      if (action === 'verify') await adminApi.verify(id);
      else await adminApi.reject(id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!users) return <p className="text-slate-500">Chargement…</p>;
  if (users.length === 0)
    return (
      <p className="text-slate-500">Aucune vérification en attente. 👍</p>
    );

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div
          key={user.id}
          className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center gap-4"
        >
          <div className="flex-1">
            <p className="font-semibold text-navy">
              {user.fullName ?? 'Sans nom'}
            </p>
            <p className="text-sm text-slate-500">
              {user.phoneNumber}
              {user.commune ? ` · ${user.commune}` : ''} · {user.accountType}
            </p>
            <div className="flex gap-4 mt-2 text-sm">
              {user.selfieUrl && (
                <a
                  className="text-orange underline"
                  href={user.selfieUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir le selfie
                </a>
              )}
              {user.idDocumentUrl && (
                <a
                  className="text-orange underline"
                  href={user.idDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la pièce
                  {user.idDocumentType ? ` (${user.idDocumentType})` : ''}
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-50"
              onClick={() => act(user.id, 'verify')}
              disabled={busyId === user.id}
            >
              Valider
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-50"
              onClick={() => act(user.id, 'reject')}
              disabled={busyId === user.id}
            >
              Rejeter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
