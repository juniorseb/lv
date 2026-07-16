import { useEffect, useState } from 'react';

import { adminApi } from '../api';
import { AdminDriver, DocumentStatus, DriverStatus } from '../types';

const DOC_LABEL: Record<string, string> = {
  cni_recto: "Pièce — recto",
  cni_verso: "Pièce — verso",
  selfie_live: 'Selfie live',
  permis: 'Permis',
  carte_grise: 'Carte grise',
  assurance: 'Assurance',
  visite_technique: 'Visite technique',
};

const DOC_BADGE: Record<DocumentStatus, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  valide: 'bg-green-100 text-green-700',
  rejete: 'bg-red-100 text-red-700',
};

const OPERATOR_LABEL: Record<string, string> = {
  orange: 'Orange Money',
  mtn: 'MTN MoMo',
  moov: 'Moov Money',
  wave: 'Wave',
};

// Alerte d'expiration d'un document : null si pas de date, 'expired' si dépassée,
// 'soon' si dans moins de 30 jours. (Comparaison de dates AAAA-MM-JJ.)
function expiryAlert(dateExpiration: string | null): 'expired' | 'soon' | null {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration + 'T00:00:00');
  if (Number.isNaN(exp.getTime())) return null;
  const now = new Date();
  const days = (exp.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days < 30) return 'soon';
  return null;
}

const VEHICLE_LABEL: Record<string, string> = {
  moto: '🏍️ Moto',
  voiture: '🚗 Voiture',
  velo: '🚲 Vélo',
  a_pied: '🚶 À pied',
  camionnette: '🚐 Camionnette',
};

const STATUS_BADGE: Record<DriverStatus, { label: string; className: string }> = {
  en_validation: {
    label: 'En validation',
    className: 'bg-amber-100 text-amber-700',
  },
  actif: { label: 'Actif', className: 'bg-green-100 text-green-700' },
  suspendu: { label: 'Suspendu', className: 'bg-red-100 text-red-700' },
};

// Validation des livreurs (spec-onboarding-livreur-v2 §4) : l'admin active ou
// suspend chaque livreur. Un livreur « en_validation » ne reçoit aucune mission.
export default function DriversPage() {
  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    adminApi
      .drivers()
      .then(setDrivers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur.'));
  };

  useEffect(load, []);

  const setStatus = async (id: string, status: DriverStatus) => {
    setBusyId(id);
    setError(null);
    try {
      const updated = await adminApi.setDriverStatus(id, status);
      setDrivers((prev) =>
        prev ? prev.map((d) => (d.driverId === id ? updated : d)) : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setBusyId(null);
    }
  };

  const setDocStatus = async (
    driverId: string,
    docId: string,
    status: DocumentStatus,
  ) => {
    setError(null);
    try {
      const updated = await adminApi.setDocumentStatus(docId, status);
      setDrivers((prev) =>
        prev
          ? prev.map((d) =>
              d.driverId === driverId
                ? {
                    ...d,
                    documents: d.documents.map((doc) =>
                      doc.id === docId ? updated : doc,
                    ),
                  }
                : d,
            )
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur.');
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!drivers) return <p className="text-slate-500">Chargement…</p>;
  if (drivers.length === 0)
    return <p className="text-slate-500">Aucun livreur inscrit.</p>;

  const pending = drivers.filter((d) => d.status === 'en_validation');

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {pending.length} livreur{pending.length > 1 ? 's' : ''} en attente de
          validation.
        </p>
      )}

      <div className="space-y-4">
        {drivers.map((driver) => {
          const badge = STATUS_BADGE[driver.status];
          const busy = busyId === driver.driverId;
          return (
            <div
              key={driver.driverId}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-navy">
                    {driver.fullName ?? 'Sans nom'}
                  </p>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {driver.phoneNumber} ·{' '}
                  {VEHICLE_LABEL[driver.vehicleType] ?? driver.vehicleType} ·{' '}
                  {driver.totalDeliveries} livraison
                  {driver.totalDeliveries > 1 ? 's' : ''}
                </p>
                {driver.zones.length > 0 && (
                  <p className="text-sm text-slate-500 mt-1">
                    Zones : {driver.zones.join(', ')}
                  </p>
                )}
                {driver.vehicle && (
                  <p className="text-sm text-slate-500 mt-1">
                    Véhicule :{' '}
                    {[
                      driver.vehicle.marque,
                      driver.vehicle.modele,
                      driver.vehicle.annee,
                      driver.vehicle.couleur,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    {driver.vehicle.immatriculation
                      ? ` — ${driver.vehicle.immatriculation}`
                      : ''}
                  </p>
                )}
                {driver.mobileMoneyOperator && (
                  <p className="text-sm text-slate-500 mt-1">
                    Compte caution :{' '}
                    {OPERATOR_LABEL[driver.mobileMoneyOperator] ??
                      driver.mobileMoneyOperator}{' '}
                    · {driver.mobileMoneyNumber}
                    {driver.mobileMoneyHolder
                      ? ` (${driver.mobileMoneyHolder})`
                      : ''}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-slate-400">
                    Identité : {driver.verificationLevel}
                  </span>
                  {driver.idDocumentUrl && (
                    <a
                      className="text-orange underline"
                      href={driver.idDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir la pièce
                      {driver.idDocumentType
                        ? ` (${driver.idDocumentType})`
                        : ''}
                    </a>
                  )}
                  {driver.selfieUrl && (
                    <a
                      className="text-orange underline"
                      href={driver.selfieUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir le selfie
                    </a>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {driver.status !== 'actif' && (
                  <button
                    className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-50"
                    onClick={() => setStatus(driver.driverId, 'actif')}
                    disabled={busy}
                  >
                    Activer
                  </button>
                )}
                {driver.status !== 'suspendu' && (
                  <button
                    className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-semibold disabled:opacity-50"
                    onClick={() => setStatus(driver.driverId, 'suspendu')}
                    disabled={busy}
                  >
                    Suspendre
                  </button>
                )}
              </div>
              </div>

              {/* Documents fournis (spec-onboarding-livreur-v2 §1 étape 4) */}
              {driver.documents.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Documents
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {driver.documents.map((doc) => {
                      const alert = expiryAlert(doc.dateExpiration);
                      return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2"
                      >
                        <a
                          className="text-orange underline flex-1 truncate"
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {DOC_LABEL[doc.type] ?? doc.type}
                          {doc.dateExpiration ? (
                            <span
                              className={`ml-1 ${
                                alert === 'expired'
                                  ? 'text-red-600'
                                  : alert === 'soon'
                                    ? 'text-amber-600'
                                    : 'text-slate-400'
                              }`}
                            >
                              {alert === 'expired'
                                ? `⚠ expiré (${doc.dateExpiration})`
                                : alert === 'soon'
                                  ? `⏳ expire le ${doc.dateExpiration}`
                                  : `exp. ${doc.dateExpiration}`}
                            </span>
                          ) : null}
                        </a>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DOC_BADGE[doc.status]}`}
                        >
                          {doc.status}
                        </span>
                        {doc.status !== 'valide' && (
                          <button
                            className="text-xs text-green-600 font-semibold"
                            onClick={() =>
                              setDocStatus(driver.driverId, doc.id, 'valide')
                            }
                          >
                            Valider
                          </button>
                        )}
                        {doc.status !== 'rejete' && (
                          <button
                            className="text-xs text-red-500 font-semibold"
                            onClick={() =>
                              setDocStatus(driver.driverId, doc.id, 'rejete')
                            }
                          >
                            Rejeter
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Photos du véhicule */}
              {driver.vehicle &&
                [
                  { url: driver.vehicle.photoAvantUrl, label: 'Avant' },
                  { url: driver.vehicle.photoArriereUrl, label: 'Arrière' },
                  { url: driver.vehicle.photoPlaqueUrl, label: 'Plaque' },
                ].some((p) => p.url) && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      Photos véhicule
                    </p>
                    <div className="flex gap-3">
                      {[
                        { url: driver.vehicle.photoAvantUrl, label: 'Avant' },
                        {
                          url: driver.vehicle.photoArriereUrl,
                          label: 'Arrière',
                        },
                        { url: driver.vehicle.photoPlaqueUrl, label: 'Plaque' },
                      ]
                        .filter((p) => p.url)
                        .map((p) => (
                          <a
                            key={p.label}
                            href={p.url!}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <img
                              src={p.url!}
                              alt={p.label}
                              className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                            />
                            <span className="text-xs text-slate-500">
                              {p.label}
                            </span>
                          </a>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
