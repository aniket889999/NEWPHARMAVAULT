import { Activity, ShieldCheck, Clock, Bot, Video, FileText, ChevronRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const modules = [
  { to: '/patient/health-assistant', title: 'Evidence Chat · TrustRAG', state: 'Core prototype', icon: Bot, description: 'Ask source-backed questions. Select an authorized case and medicine to inspect exact evidence and answer freshness.' },
  { to: '/cases', title: 'Verification Cases', state: 'Core prototype', icon: ShieldCheck, description: 'Upload prescription and invoice documents, inspect extracted fields, and follow the human review workflow.' },
  { to: '/patient/prescriptions', title: 'Legacy Prescription Upload', state: 'Legacy / partial', icon: FileText, description: 'Earlier prescription-only flow. Use Verification Cases for the current secure OCR and cross-document workflow.' },
  { to: '/patient/reminders', title: 'Smart Reminders', state: 'Partial', icon: Clock, description: 'Manage reminder records. Automatic scheduling is not implemented; email delivery requires separate configuration.' },
  { to: '/patient/health-tracker', title: 'Health Tracker', state: 'Sample display', icon: Activity, description: 'Illustrative vitals and reports, not live measurements, a diagnosis or an assessment of your health.' },
  { to: '/patient/authenticity', title: 'Local Ledger Demo', state: 'Simulation', icon: ShieldCheck, description: 'Academic QR/ledger and regulatory examples. These do not certify medicine authenticity or official approval.' },
  { to: '/patient/doctor-consult', title: 'Teleconsultation Demo', state: 'Simulation', icon: Video, description: 'Booking and video-room mock-up. No real clinician appointment, payment or encrypted video service is connected.' },
  { to: '/patient/health-records', title: 'Legacy Health Records', state: 'Legacy / partial', icon: FileText, description: 'Earlier prescription records. This is separate from the current TrustRAG case evidence and audit trail.' },
];

export default function PatientDashboard() {
  return <div className="mx-auto max-w-7xl space-y-8 p-8">
    <section className="rounded-3xl bg-slate-900 p-8 text-white">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-300">PharmaVault · academic prototype</p>
      <h1 className="mb-3 text-3xl font-bold">Your document evidence workspace</h1>
      <p className="max-w-2xl leading-7 text-slate-300">The current project connects secure verification cases, medicine comparisons, evidence chat and human review. It does not diagnose, prescribe or approve insurance claims.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/patient/health-assistant" className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 font-semibold text-slate-950"><Bot size={19} /> Open Evidence Chat</Link>
        <Link to="/cases/new" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-5 py-3 font-semibold"><FileText size={19} /> Create Verification Case</Link>
      </div>
    </section>
    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900">Project modules and their current scope</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{modules.map(({ to, title, state, icon: Icon, description }) => <Link key={to} to={to} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-400">
        <div className="mb-4 flex items-center justify-between gap-3"><Icon size={25} className="text-teal-700" /><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{state}</span></div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3><p className="text-sm leading-6 text-slate-600">{description}</p>
        <span className="mt-4 inline-flex items-center text-sm font-semibold text-teal-800">Open module <ChevronRight size={16} /></span>
      </Link>)}</div>
    </section>
    <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
      <p className="flex items-center gap-2 text-sm text-slate-600"><Package size={18} /> Shopping and orders remain a separate legacy prototype.</p>
      <Link to="/patient/orders" className="text-sm font-semibold text-teal-800">View orders</Link>
    </section>
  </div>;
}
