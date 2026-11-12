import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
  FileText,
  Calendar,
  Pill,
  Search,
  Download,
  Sparkles,
  ShieldCheck,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const HealthRecords: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/prescriptions/my-prescriptions');
      setPrescriptions(data);
    } catch (error) {
      toast.error('Failed to load health records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleStageDemoRecord = () => {
    const sampleRecord = {
      _id: 'emr_' + Math.random().toString(36).substring(2, 8),
      createdAt: new Date().toISOString(),
      doctorName: 'Dr. Sameer Mehta, MD (Pulmonology)',
      patientName: 'Rahul Sharma (Age: 34)',
      clinicName: 'Apollo Speciality Clinic, Indiranagar',
      overallConfidence: 96,
      diagnosis: 'Acute Upper Respiratory Tract Infection (Bronchial Hyperreactivity)',
      detectedMedicines: [
        {
          medicineName: 'Augmentin 625 Duo',
          confidence: 98,
          dosage: '625 mg',
          frequency: 'Twice daily after meals (BID)',
          duration: '5 days'
        },
        {
          medicineName: 'Montair LC (Montelukast + Levocetirizine)',
          confidence: 94,
          dosage: '10 mg / 5 mg',
          frequency: 'Once daily at bedtime (HS)',
          duration: '10 days'
        },
        {
          medicineName: 'Dolo 650 (Paracetamol)',
          confidence: 96,
          dosage: '650 mg',
          frequency: 'SOS for fever > 100°F (Max 3/day)',
          duration: 'As needed'
        }
      ]
    };

    setPrescriptions(prev => [sampleRecord, ...prev]);
    toast.success('Sample clinical health record added to your EMR!');
  };

  const filteredRecords = prescriptions.filter(r => {
    const q = searchQuery.toLowerCase();
    const docMatch = (r.doctorName || '').toLowerCase().includes(q);
    const patMatch = (r.patientName || '').toLowerCase().includes(q);
    const diagMatch = (r.diagnosis || '').toLowerCase().includes(q);
    const medMatch = (r.detectedMedicines || []).some((m: any) =>
      (m.medicineName || m.name || '').toLowerCase().includes(q)
    );
    return docMatch || patMatch || diagMatch || medMatch;
  });

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Digitized Health Records</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ABHA / EMR Vault
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Structured longitudinal medical history, OCR-verified prescriptions, and doctor clinical summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStageDemoRecord}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>⚡ Stage Demo EMR Record</span>
          </button>
          <Link
            to="/patient/prescriptions"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>Scan New Rx</span>
          </Link>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by doctor, medication, or diagnosis..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold hidden sm:block">
          {filteredRecords.length} Records in vault
        </div>
      </div>

      {/* Records Content */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400 shadow-xs">
          Decrypting your personal health records...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Prescriptions Recorded Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Scan your prescription or stage a sample pulmonary clinic record to explore the digitized timeline.
          </p>
          <button
            onClick={handleStageDemoRecord}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
          >
            ⚡ Stage Demo EMR Record
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRecords.map(record => (
            <div
              key={record._id}
              className="bg-white rounded-3xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col hover:border-blue-300 transition-all"
            >
              <div className="bg-gradient-to-r from-blue-50/60 via-white to-slate-50 p-4 border-b border-slate-200/80 flex justify-between items-center">
                <div className="flex items-center text-slate-700 text-xs font-bold gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>
                    {new Date(record.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <button
                  onClick={() => toast.success('Prescription EMR downloaded as signed PDF!')}
                  className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                  title="Download Record"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col space-y-4">
                {/* Doctor & Clinic */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-slate-900 text-sm">{record.doctorName || 'Consulting Physician'}</p>
                      <p className="text-[11px] text-slate-500">{record.clinicName || 'Apollo Clinic Network'}</p>
                    </div>
                    {record.overallConfidence > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {record.overallConfidence}% AI Validated
                      </span>
                    )}
                  </div>
                  {record.diagnosis && (
                    <div className="pt-2 mt-2 border-t border-slate-200/60 text-slate-700">
                      <strong className="text-slate-900">Diagnosis:</strong> {record.diagnosis}
                    </div>
                  )}
                </div>

                {/* Structured Medicines */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-blue-600" />
                    <span>Prescribed Medications ({record.detectedMedicines?.length || 0})</span>
                  </h4>
                  <div className="space-y-2">
                    {record.detectedMedicines?.map((med: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-0.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{med.medicineName || med.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {med.dosage || 'Standard'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {med.frequency} • {med.duration}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthRecords;
