import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Video, CalendarClock, FileText, ArrowRight } from 'lucide-react';

/**
 * Doctor consultation is planned future work. This page explains what is coming and
 * points the patient to what already works today.
 */
const DoctorConsult: React.FC = () => (
  <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 font-sans">
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
        <Stethoscope className="w-7 h-7 text-teal-700" />
      </div>
      <span className="inline-block text-[10px] font-bold uppercase px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-full tracking-wider">Coming soon</span>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Consultation</h1>
      <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
        Online consultations with registered doctors are planned for a future release. Prescriptions from a consultation will flow straight into your prescriptions, reminders and pharmacy orders.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { icon: Video, title: 'Video consultation', text: 'Book a time slot and consult a registered doctor online.' },
        { icon: FileText, title: 'Digital prescription', text: 'The doctor’s prescription is saved to your health records automatically.' },
        { icon: CalendarClock, title: 'Follow-ups', text: 'Reminders for follow-up visits and refills.' }
      ].map(({ icon: Icon, title, text }) => (
        <div key={title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <Icon className="w-5 h-5 text-teal-600" />
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
        </div>
      ))}
    </div>

    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-900">
      <span>Already have a prescription from your doctor? Upload it to get reminders and order your medicines.</span>
      <Link to="/patient/prescriptions" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold">
        Upload prescription <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </div>
);

export default DoctorConsult;
