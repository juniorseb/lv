import { useEffect, useState } from 'react';

import { adminApi } from '../api';
import { AdminStats } from '../types';

export default function StatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur.'));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-slate-500">Chargement…</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Utilisateurs" value={stats.users} />
      <Stat label="Livreurs" value={stats.drivers} />
      <Stat label="Commerces" value={stats.commerces} />
      <Stat label="Pièces en attente" value={stats.pendingVerifications} highlight />
      <Stat label="Livreurs à valider" value={stats.pendingDrivers} highlight />
      <Stat label="Livraisons" value={stats.deliveries.total} />
      <Stat label="En recherche" value={stats.deliveries.recherche} />
      <Stat label="En cours" value={stats.deliveries.enCours} />
      <Stat label="Terminées" value={stats.deliveries.terminee} />
      {/* Indicateur de santé de l'offre : des courses sans réponse = pas assez
          de livreurs disponibles au bon endroit / au bon moment. */}
      <Stat label="Sans réponse" value={stats.deliveries.expiree} highlight />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`text-3xl font-bold mt-1 ${
          highlight && value > 0 ? 'text-orange' : 'text-navy'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
