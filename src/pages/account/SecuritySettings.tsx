import React, { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import toast from 'react-hot-toast';
import { KeyRound, ShieldCheck, Copy, ShieldOff, LifeBuoy, AlertTriangle, Download, Trash2, MessageSquare } from 'lucide-react';
import { privacyApi, DataRequestView } from '../../api/privacyApi';
import { qrSvg } from '../../lib/qrCode';
import LanguageSwitch from '../../components/common/LanguageSwitch';
import apiClient from '../../api/apiClient';
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
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [regenCode, setRegenCode] = useState('');
  const enabled = Boolean(user?.mfaEnabled);
  const required = Boolean(user?.mfaSetupRequired);
  const isPatient = user?.role === 'patient';
  const t = useT();
  const [textAlerts, setTextAlerts] = useState<{ enabled: boolean; channel: 'sms' | 'whatsapp'; phone: string | null } | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [channelInput, setChannelInput] = useState<'sms' | 'whatsapp'>('sms');
  useEffect(() => {
    if (!isPatient) return;
    apiClient.get('/users/profile').then((res) => setTextAlerts(res.data?.textAlerts || { enabled: false, channel: 'sms', phone: null })).catch(() => {});
  }, [isPatient]);
  const saveTextAlerts = async (enabled: boolean) => {
    setBusy(true);
    try {
      const res = await apiClient.post('/users/me/text-alerts', enabled ? { enabled, phone: phoneInput, channel: channelInput } : { enabled });
      setTextAlerts(res.data);
      setPhoneInput('');
      toast.success(enabled ? (res.data.deliveryConfigured ? 'Text alerts turned on' : 'Saved. Text alerts will start once your pharmacy platform enables the SMS service.') : 'Text alerts turned off and your number removed');
    } catch (err) {
      toast.error(errorMessage(err, 'Text alerts could not be saved.'));
    } finally {
      setBusy(false);
    }
  };
  const [requests, setRequests] = useState<DataRequestView[]>([]);
  const [erasureReason, setErasureReason] = useState('');
  const [showErasure, setShowErasure] = useState(false);
  const openErasure = requests.find((r) => r.type === 'ERASURE' && r.status === 'OPEN');

  const loadRequests = async () => {
    try { setRequests(await privacyApi.myRequests()); } catch { /* the section still works without history */ }
  };
  useEffect(() => { if (!required) void loadRequests(); }, [required]);

  const download = async (format: 'html' | 'json') => {
    setBusy(true);
    try {
      await privacyApi.downloadMyData(format);
      toast.success('Your data was downloaded');
      await loadRequests();
    } catch (err) {
      toast.error(errorMessage(err, 'The export could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  const requestErasure = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await privacyApi.requestErasure(erasureReason.trim());
      toast.success('Deletion request sent. We will confirm within 30 days.');
      setShowErasure(false);
      setErasureReason('');
      await loadRequests();
    } catch (err) {
      toast.error(errorMessage(err, 'The request could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const cancelErasure = async (id: string) => {
    setBusy(true);
    try {
      await privacyApi.cancel(id);
      toast.success('Deletion request cancelled');
      await loadRequests();
    } catch (err) {
      toast.error(errorMessage(err, 'The request could not be cancelled.'));
    } finally {
      setBusy(false);
    }
  };

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
        const result = await claimsApi.mfaEnable(code.trim());
        if (result?.recoveryCodes?.length) setRecoveryCodes(result.recoveryCodes);
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

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await claimsApi.mfaRecoveryCodes(regenCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setRegenCode('');
      toast.success('New recovery codes created. The old ones no longer work.');
    } catch (err) {
      toast.error(errorMessage(err, 'The code was not accepted.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6 font-sans">
      {required && (
        <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Your organization requires two-factor authentication for staff accounts. Turn it on below to continue to your workspace.
        </p>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><KeyRound className="w-6 h-6 text-teal-600" /> {t('Account Security')}</h1>
            <p className="text-xs text-slate-500 max-w-xl">Two-factor authentication asks for a 6-digit code from an authenticator app every time you sign in. Recommended for all staff and insurer accounts.</p>
          </div>
          <div className="flex flex-col items-end gap-2"><LanguageSwitch />
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
            {enabled ? 'MFA on' : 'MFA off'}
          </span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
        {!enabled && !setup && (
          <button disabled={busy} onClick={start} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <ShieldCheck className="w-4 h-4" /> {t('Set Up Authenticator App')}
          </button>
        )}

        {!enabled && setup && (
          <div className="space-y-3">
            <p className="font-semibold text-slate-800">1. Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan this QR code:</p>
            <img alt="QR code for your authenticator app" className="w-44 h-44 border border-slate-200 rounded-lg p-1 bg-white" src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg(setup.otpauthUri))}`} />
            <p className="text-slate-500">Can't scan? Choose “Enter a setup key” in the app and type this key:</p>
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
              {enabled ? <><ShieldOff className="w-4 h-4" /> {t('Turn Off')}</> : <><ShieldCheck className="w-4 h-4" /> {t('Turn On')}</>}
            </button>
          </form>
        )}
      </div>

      {recoveryCodes && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-xs space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-amber-600" /> {t('Save your recovery codes')}</h2>
          <p className="text-slate-600">Each code works once, instead of an authenticator code, if you lose your phone. They are shown only now — store them somewhere safe.</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">
            {recoveryCodes.map((c) => <li key={c} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center tracking-wider">{c}</li>)}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n')).then(() => toast.success('Copied'))} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5"><Copy className="w-4 h-4" /> Copy codes</button>
            <button type="button" onClick={() => setRecoveryCodes(null)} className="px-3 py-2 rounded-lg bg-slate-900 text-white font-semibold">{t('I have saved them')}</button>
          </div>
        </div>
      )}

      {enabled && !recoveryCodes && (
        <form onSubmit={regenerate} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-slate-500" /> Recovery codes</h2>
          <p className="text-slate-500">Lost your codes or used most of them? Create a new set. The old set stops working.</p>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="regen-code" className="block font-semibold text-slate-700 mb-1">Current authenticator code</label>
              <input id="regen-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ''))} className="w-40 px-3 py-2 border border-slate-300 rounded-lg font-mono text-base tracking-widest" />
            </div>
            <button disabled={busy || regenCode.length !== 6} className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold disabled:opacity-50">Create New Codes</button>
          </div>
        </form>
      )}

      {isPatient && textAlerts && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3 text-xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-teal-600" /> {t('Text alerts')}</h2>
          <p className="text-slate-500 max-w-xl">{t('Get an SMS or WhatsApp message when your insurer asks a question or decides your claim. The message only says that something changed — no medicine or claim details.')}</p>
          {textAlerts.enabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">{textAlerts.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} · {textAlerts.phone}</span>
              <button type="button" disabled={busy} onClick={() => void saveTextAlerts(false)} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold disabled:opacity-50">{t('Turn Off')}</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void saveTextAlerts(true); }} className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="alert-phone" className="block font-semibold text-slate-700 mb-1">{t('Mobile number')}</label>
                <input id="alert-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="w-44 px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label htmlFor="alert-channel" className="block font-semibold text-slate-700 mb-1">{t('Send by')}</label>
                <select id="alert-channel" value={channelInput} onChange={(e) => setChannelInput(e.target.value as 'sms' | 'whatsapp')} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <button disabled={busy || phoneInput.trim().length < 10} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold disabled:opacity-50">{t('Turn On')}</button>
            </form>
          )}
        </div>
      )}

      {!required && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">{t('Your Data')}</h2>
            <p className="text-slate-500 max-w-xl">Download a copy of the data PharmaVault holds about you{isPatient ? ', or ask us to delete it' : ''}. The readable copy opens in your browser; use Print → “Save as PDF” to keep it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void download('html')} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"><Download className="w-4 h-4" /> {t('Download My Data (readable)')}</button>
            <button type="button" disabled={busy} onClick={() => void download('json')} className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold flex items-center gap-1.5 disabled:opacity-50">{t('Full copy (JSON)')}</button>
            {isPatient && !openErasure && (
              <button type="button" disabled={busy} onClick={() => setShowErasure(true)} className="px-4 py-2.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold flex items-center gap-1.5 disabled:opacity-50"><Trash2 className="w-4 h-4" /> {t('Request Deletion')}</button>
            )}
          </div>
          {openErasure && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 flex items-center justify-between gap-3">
              <span>Deletion requested on {new Date(openErasure.createdAt).toLocaleDateString('en-IN')}{openErasure.dueBy ? ` · to be completed by ${new Date(openErasure.dueBy).toLocaleDateString('en-IN')}` : ''}. Open claims must be withdrawn or decided first.</span>
              <button type="button" disabled={busy} onClick={() => void cancelErasure(openErasure.id)} className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-semibold disabled:opacity-50">{t('Cancel Request')}</button>
            </div>
          )}
          {showErasure && (
            <form onSubmit={requestErasure} className="space-y-2 rounded-xl border border-rose-200 p-4">
              <p className="text-slate-700">We will delete your uploaded documents and extracted details, withdraw every data-sharing consent, and remove your name and email from your account. Claim decisions and the audit record are kept because insurers and regulators may need them. You will be signed out.</p>
              <label htmlFor="erasure-reason" className="block font-semibold text-slate-700">Reason (optional)</label>
              <textarea id="erasure-reason" maxLength={1000} rows={2} value={erasureReason} onChange={(e) => setErasureReason(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowErasure(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">{t('Cancel')}</button>
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50">{t('Send Deletion Request')}</button>
              </div>
            </form>
          )}
          {requests.length > 0 && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100" aria-label="Data request history">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2 flex justify-between text-slate-600">
                  <span>{r.type === 'EXPORT' ? 'Data download' : 'Deletion request'} · {new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  <span className="font-semibold">{r.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SecuritySettings;
