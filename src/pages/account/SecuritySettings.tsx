import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, ShieldCheck, Copy, ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { claimsApi, errorMessage } from '../../api/claimsApi';

/**
 * TOTP MFA enrolment for any signed-in role. The secret is shown once here;
 * the server stores it encrypted. Works with Google Authenticator, Microsoft
 * Authenticator, 1Password, etc.
 */
const SecuritySettings: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(user?.mfaEnabled);

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await claimsApi.mfaSetup());
    } catch (err) {
      toast.error(errorMessage(err, 'MFA setup could not start.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (enabled) {
        await claimsApi.mfaDisable(code.trim());
        toast.success('Two-factor authentication turned off');
      } else {
        await claimsApi.mfaEnable(code.trim());
        toast.success('Two-factor authentication is on. Other sessions were signed out.');
        setSetup(null);
      }
      setCode('');
      await refreshProfile();
    } catch (err) {
      toast.error(errorMessage(err, 'The code was not accepted.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><KeyRound className="w-6 h-6 text-teal-600" /> Account Security</h1>
            <p className="text-xs text-slate-500 max-w-xl">Two-factor authentication asks for a 6-digit code from an authenticator app every time you sign in. Recommended for all staff and insurer accounts.</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
            {enabled ? 'MFA on' : 'MFA off'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
        {!enabled && !setup && (
          <button disabled={busy} onClick={start} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <ShieldCheck className="w-4 h-4" /> Set Up Authenticator App
          </button>
        )}

        {!enabled && setup && (
          <div className="space-y-3">
            <p className="font-semibold text-slate-800">1. In your authenticator app, add an account using this setup key:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-sm tracking-wider break-all">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(setup.secret).then(() => toast.success('Copied'))} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Copy setup key"><Copy className="w-4 h-4" /></button>
            </div>
            <p className="text-slate-500">Choose “time-based”. On a phone you can also open this link: <a className="text-teal-700 underline break-all" href={setup.otpauthUri}>authenticator link</a>.</p>
            <p className="font-semibold text-slate-800">2. Enter the 6-digit code it shows:</p>
          </div>
        )}

        {(enabled || setup) && (
          <form onSubmit={confirm} className="flex items-end gap-2">
            <div>
              <label htmlFor="mfa-code" className="block font-semibold text-slate-700 mb-1">{enabled ? 'Current code (to turn MFA off)' : 'Verification code'}</label>
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-40 px-3 py-2 border border-slate-300 rounded-lg font-mono text-base tracking-widest" />
            </div>
            <button disabled={busy || code.length !== 6} className={`px-4 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 ${enabled ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
              {enabled ? <><ShieldOff className="w-4 h-4" /> Turn Off</> : <><ShieldCheck className="w-4 h-4" /> Turn On</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SecuritySettings;
