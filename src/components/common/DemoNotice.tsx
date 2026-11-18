import React from 'react';
import { useLocation } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

/**
 * Honest labelling for screens that use simulated or sample data. The core product —
 * verification cases, OCR + reconciliation, Evidence Chat (TrustRAG), pharmacist review,
 * claims and the insurer portal — works on real application data and is NOT listed here.
 */
const DEMO_SCREENS: Array<{ match: RegExp; text: string }> = [
  { match: /^\/patient\/doctor-consult/, text: 'Doctor consultation is a simulation: no real doctor, payment or video call.' },
  { match: /^\/patient\/nearby-medicines/, text: 'Nearby availability uses a simulated pharmacy directory: stock and reservations are not live.' },
  { match: /^\/patient\/health-tracker/, text: 'Health tracker shows sample data, not measured vitals or clinical predictions.' },
  { match: /^\/patient\/reminders/, text: 'Reminders are stored but not scheduled or sent yet.' },
  { match: /^\/patient\/authenticity/, text: 'Authenticity results come from mock regulatory responses, not an official CDSCO check.' },
  { match: /^\/patient\/intelligence/, text: 'Patient insights are heuristic sample analytics, not clinical predictions.' },
  { match: /^\/patient\/health-records/, text: 'Health records is a basic prototype: download and search are not complete.' },
  { match: /^\/pharmacy\/blockchain/, text: 'Ledger is a local hash-chain demonstration, not a distributed blockchain or certification.' },
  { match: /^\/pharmacy\/(operations-intelligence|stock-risk|expiry-risk)/, text: 'Analytics on this page use sample and heuristic data, not validated forecasts.' },
  { match: /^\/pharmacy\/organization/, text: 'Billing and subscriptions are not connected to a payment provider.' }
];

const DemoNotice: React.FC = () => {
  const { pathname } = useLocation();
  const hit = DEMO_SCREENS.find((s) => s.match.test(pathname));
  if (!hit) return null;
  return (
    <div role="note" className="mx-4 md:mx-8 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-center gap-2">
      <FlaskConical className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span><strong className="font-bold">Demo feature.</strong> {hit.text}</span>
    </div>
  );
};

export default DemoNotice;
