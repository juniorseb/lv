import { useState } from 'react';

import { ApiError, authApi, setToken } from '../api';
import { AdminUser } from '../types';

// Connexion au back-office par OTP téléphone. Seuls les comptes administrateurs
// (is_admin) sont autorisés à entrer.
export default function LoginPage({
  onAuthenticated,
}: {
  onAuthenticated: (user: AdminUser) => void;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPhone = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.requestOtp(phone.trim());
      setPhone(result.phoneNumber);
      setStep('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.verifyOtp(phone, code.trim());
      if (!user.isAdmin) {
        setError('Ce compte n\'a pas accès au back-office.');
        return;
      }
      setToken(accessToken);
      onAuthenticated(user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Code incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-orange text-center">Livrechap</h1>
        <p className="text-center text-navy text-sm mb-8">Back-office</p>

        {step === 'phone' ? (
          <>
            <label className="block text-sm font-semibold text-navy mb-2">
              Numéro administrateur
            </label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-orange"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07 00 00 00 00"
              inputMode="tel"
            />
            <button
              className="w-full mt-6 bg-orange text-white font-semibold rounded-xl py-3 disabled:opacity-50"
              onClick={submitPhone}
              disabled={loading || phone.replace(/\D/g, '').length < 8}
            >
              {loading ? '…' : 'Recevoir le code'}
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-navy mb-2">
              Code reçu par SMS
            </label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-2xl text-center tracking-widest focus:outline-none focus:border-orange"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="––––––"
              inputMode="numeric"
              maxLength={8}
            />
            <button
              className="w-full mt-6 bg-orange text-white font-semibold rounded-xl py-3 disabled:opacity-50"
              onClick={submitCode}
              disabled={loading || code.length < 4}
            >
              {loading ? '…' : 'Se connecter'}
            </button>
            <button
              className="w-full mt-3 text-sm text-slate-500"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              Changer de numéro
            </button>
          </>
        )}

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}
