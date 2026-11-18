import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, UserPlus, ShieldCheck, ShieldAlert, X, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { errorMessage } from '../../api/claimsApi';

interface StaffRow { id: string; name: string; email: string; role: string; mfaEnabled: boolean; createdAt: string }
interface TeamResponse { organization: { id: string; name: string; kind: 'pharmacy' | 'payer' }; assignableRoles: string[]; staff: StaffRow[] }

const ROLE_LABEL: Record<string, string> = {
  pharmacist: 'Pharmacist',
  pharmacy: 'Pharmacy operator',
  claims_reviewer: 'Claims reviewer',
  org_admin: 'Organization admin',
  branch_manager: 'Branch manager',
  payer_reviewer: 'Insurer claims reviewer',
  payer_admin: 'Insurer admin'
};

/**
 * Team & Access for organization administrators (pharmacy org_admin or insurer payer_admin).
 * Accounts are created with a temporary password the admin shares out of band;
 * the backend restricts roles to the admin's own organization type.
 */
const TeamAccess: React.FC = () => {
  const [data, setData] = useState<TeamResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '' });

  const load = async () => {
    try {
      const res = await apiClient.get<TeamResponse>('/users/staff');
      setData(res.data);
      setFailed(null);
      setForm((f) => ({ ...f, role: f.role || res.data.assignableRoles[0] || '' }));
    } catch (err) {
      setFailed(errorMessage(err, 'Team members could not be loaded.'));
    }
  };

  useEffect(() => { void load(); }, []);

  const tone = data?.organization.kind === 'payer'
    ? { badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', button: 'bg-indigo-700 hover:bg-indigo-800', ring: 'focus:ring-indigo-600' }
    : { badge: 'bg-teal-50 text-teal-800 border-teal-200', button: 'bg-teal-600 hover:bg-teal-700', ring: 'focus:ring-teal-600' };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient.post('/users/provision-staff', { ...form, email: form.email.trim(), name: form.name.trim() });
      toast.success(`${form.name.trim()} added as ${ROLE_LABEL[form.role] || form.role}`);
      setShowAdd(false);
      setForm({ name: '', email: '', role: data?.assignableRoles[0] || '', password: '' });
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Account could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  const withoutMfa = (data?.staff || []).filter((s) => !s.mfaEnabled).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <span className={`text-xs font-semibold uppercase px-2.5 py-0.5 border rounded-full ${tone.badge}`}>Administration</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-slate-600" /> Team & Access</h1>
          <p className="text-xs text-slate-500">{data ? `${data.organization.name} · ${data.organization.kind === 'payer' ? 'Insurer organization' : 'Pharmacy organization'}` : 'Loading organization…'}</p>
        </div>
        <div className="flex gap-2 self-start">
          <button onClick={load} className="px-3 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setShowAdd(true)} disabled={!data} className={`px-4 py-2.5 rounded-lg text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 ${tone.button}`}><UserPlus className="w-4 h-4" /> Add Staff Member</button>
        </div>
      </div>

      {failed && <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">{failed}</p>}
      {data && withoutMfa > 0 && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {withoutMfa} of {data.staff.length} staff account(s) have not turned on two-factor authentication. Ask them to open Security & MFA.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Role</th><th className="py-3 px-4">MFA</th><th className="py-3 px-5">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data && !failed && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading…</td></tr>}
            {data?.staff.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="py-3 px-5 font-semibold text-slate-800">{s.name}</td>
                <td className="py-3 px-4 text-slate-600">{s.email}</td>
                <td className="py-3 px-4">{ROLE_LABEL[s.role] || s.role}</td>
                <td className="py-3 px-4">
                  {s.mfaEnabled
                    ? <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck className="w-3.5 h-3.5" /> On</span>
                    : <span className="text-amber-700">Off</span>}
                </td>
                <td className="py-3 px-5 text-slate-500">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && data && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3 text-xs">
              <div>
                <label htmlFor="staff-name" className="block font-semibold text-slate-700 mb-1">Full name</label>
                <input id="staff-name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 ${tone.ring}`} />
              </div>
              <div>
                <label htmlFor="staff-email" className="block font-semibold text-slate-700 mb-1">Work email</label>
                <input id="staff-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 ${tone.ring}`} />
              </div>
              <div>
                <label htmlFor="staff-new-role" className="block font-semibold text-slate-700 mb-1">Role</label>
                <select id="staff-new-role" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  {data.assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="staff-password" className="block font-semibold text-slate-700 mb-1">Temporary password (15+ characters)</label>
                <input id="staff-password" type="password" autoComplete="new-password" required minLength={15} maxLength={72} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`w-full border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 ${tone.ring}`} />
                <p className="text-[11px] text-slate-500 mt-1">Share it privately. Ask the person to turn on two-factor authentication after the first sign-in.</p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={busy} className={`text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50 ${tone.button}`}>{busy ? 'Creating…' : 'Create Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamAccess;
