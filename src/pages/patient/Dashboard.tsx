import React from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Clock, 
  Video, 
  ChevronRight, 
  Stethoscope, 
  CheckCircle2, 
  Pill,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientDashboard: React.FC = () => {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Patient Clinical Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
                Active Care Plan
              </span>
              <span className="text-xs text-slate-400 font-mono">Patient ID: PV-PT-9042</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Patient Care & Medication Overview
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Manage your digital prescriptions, verify medicine packaging authenticity, and track your active medication schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/patient/prescriptions"
              className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Upload Prescription</span>
            </Link>

            <Link
              to="/patient/authenticity"
              className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs flex items-center space-x-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Verify Batch</span>
            </Link>
          </div>
        </div>

        {/* Clinical Metric Strips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Active Prescriptions</span>
              <FileText className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">2</div>
            <p className="text-[11px] text-teal-700 font-medium mt-1">Verified on file</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Batch Integrity</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">100%</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Authentic ledger match</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Next Scheduled Dose</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">09:00 PM</div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">Dolo 650mg (Post-dinner)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">Upcoming Consult</span>
              <Video className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">Tomorrow</div>
            <p className="text-[11px] text-blue-700 font-medium mt-1">Dr. Sharma (Cardiology)</p>
          </div>
        </div>
      </div>

      {/* Primary Workflows Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Clinical Workflows & Features</h2>
            <p className="text-xs text-slate-500">Select a specialized tool to proceed</p>
          </div>
          <span className="text-xs font-medium text-slate-400">All Modules Online</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Prescription Upload & OCR */}
          <Link
            to="/patient/prescriptions"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Prescription Upload & OCR</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload image or PDF prescriptions for privacy-preserving local OCR extraction, dosage verification, and digital filing.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-700 mt-5 pt-3 border-t border-slate-100">
              <span>Open Scanner</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 2. Authenticity Verifier */}
          <Link
            to="/patient/authenticity"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Authenticity Verifier</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Scan pharmaceutical QR barcodes or input batch numbers to verify packaging against our immutable medicine ledger.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-emerald-700 mt-5 pt-3 border-t border-slate-100">
              <span>Verify Medicine</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 3. Verification Cases */}
          <Link
            to="/patient/cases"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Verification Audits</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Track full verification lifecycle cases, cross-document item comparisons, and authorized human auditor findings.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-700 mt-5 pt-3 border-t border-slate-100">
              <span>View Audits</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 4. Health Assistant */}
          <Link
            to="/patient/health-assistant"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Health Assistant</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Consult our clinical guidance companion for drug interactions, side effects, dietary advice, and safety guidelines.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-teal-700 mt-5 pt-3 border-t border-slate-100">
              <span>Start Consultation</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 5. Medication Reminders */}
          <Link
            to="/patient/reminders"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Medication Reminders</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated dosage schedules with multi-channel alerts to ensure consistent adherence to prescribed therapy.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-700 mt-5 pt-3 border-t border-slate-100">
              <span>Manage Schedules</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 6. Teleconsultation */}
          <Link
            to="/patient/doctor-consult"
            className="group bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Doctor Teleconsult</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Encrypted remote video appointments with certified practitioners for prescription reviews and follow-ups.
              </p>
            </div>
            <div className="flex items-center text-xs font-semibold text-blue-700 mt-5 pt-3 border-t border-slate-100">
              <span>Book Appointment</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Active Medications & Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Current Medications On File</h3>
            <p className="text-xs text-slate-500">Verified medicines in your active prescription registry</p>
          </div>
          <Link
            to="/patient/medicines"
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center space-x-1"
          >
            <span>Browse Full Catalogue</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5">Medicine Name</th>
                <th className="py-3 px-4">Dosage & Type</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Ledger Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3.5 px-5 font-semibold text-slate-900">
                  <div className="flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Dolo 650mg</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">650 mg • Tablet</td>
                <td className="py-3.5 px-4 text-slate-500">Micro Labs</td>
                <td className="py-3.5 px-4 font-mono text-slate-700">B-DLO-650</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Authentic
                  </span>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    to="/patient/authenticity?batch=B-DLO-650"
                    className="text-teal-700 hover:text-teal-800 font-semibold"
                  >
                    View Record
                  </Link>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3.5 px-5 font-semibold text-slate-900">
                  <div className="flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Azithromycin 500mg</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">500 mg • Tablet</td>
                <td className="py-3.5 px-4 text-slate-500">Cipla</td>
                <td className="py-3.5 px-4 font-mono text-slate-700">B-AZE-500</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Authentic
                  </span>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    to="/patient/authenticity?batch=B-AZE-500"
                    className="text-teal-700 hover:text-teal-800 font-semibold"
                  >
                    View Record
                  </Link>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3.5 px-5 font-semibold text-slate-900">
                  <div className="flex items-center space-x-2">
                    <Pill className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>Pantoprazole 40mg</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">40 mg • Capsule</td>
                <td className="py-3.5 px-4 text-slate-500">Alkem Laboratories</td>
                <td className="py-3.5 px-4 font-mono text-slate-700">B-PAN-040</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Authentic
                  </span>
                </td>
                <td className="py-3.5 px-5 text-right">
                  <Link
                    to="/patient/authenticity?batch=B-PAN-040"
                    className="text-teal-700 hover:text-teal-800 font-semibold"
                  >
                    View Record
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
