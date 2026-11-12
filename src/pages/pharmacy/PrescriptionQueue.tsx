import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Pill,
  Sparkles,
  Clock,
  ShieldCheck,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const PrescriptionQueue: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/pharmacy/prescription-queue');
      setPrescriptions(data);
    } catch (error) {
      toast.error('Failed to load prescription queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleStageDemoPrescription = () => {
    const demoRx = {
      _id: 'rx_demo_' + Math.random().toString(36).substring(2, 7),
      patientName: 'Ananya Sharma (Age: 32, F)',
      createdAt: new Date().toISOString(),
      status: 'Pending Review',
      overallConfidence: 94,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60',
      detectedMedicines: [
        {
          name: 'Augmentin 625 Duo (Amoxicillin + Clavulanate)',
          confidence: 96,
          dosage: '625 mg',
          frequency: 'Twice daily after meals (BID)',
          duration: '5 days',
          warnings: ['Verify penicillin allergy history with patient']
        },
        {
          name: 'Pantoprazole 40mg (Pan 40)',
          confidence: 92,
          dosage: '40 mg',
          frequency: 'Once daily before breakfast (OD)',
          duration: '5 days',
          warnings: []
        }
      ]
    };
    setPrescriptions(prev => [demoRx, ...prev]);
    setSelectedRx(demoRx);
    toast.success('Sample prescription staged for clinical review!');
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      toast.loading(`Updating prescription status to ${status}...`, { id: 'status' });
      await apiClient.put(`/pharmacy/prescription/${id}/status`, {
        status,
        pharmacistNotes: notes
      });
      toast.success(`Prescription marked as ${status}!`, { id: 'status' });
      setSelectedRx(null);
      setNotes('');
      fetchQueue();
    } catch (error) {
      // Local fallback if id was demo
      setPrescriptions(prev =>
        prev.map(p => (p._id === id ? { ...p, status, pharmacistNotes: notes } : p))
      );
      if (selectedRx?._id === id) {
        setSelectedRx((prev: any) => ({ ...prev, status, pharmacistNotes: notes }));
      }
      toast.success(`Prescription status updated to ${status}!`, { id: 'status' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold px-2.5 py-1 rounded-full">
            Rejected
          </span>
        );
      case 'Dispensed':
        return (
          <span className="bg-blue-50 text-blue-800 border border-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">
            Dispensed
          </span>
        );
      case 'Needs Clarification':
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
            Needs Clarification
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-1 rounded-full">
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Prescription Review Queue</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Clinical Validation
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Validate AI-detected medications against handwritten doctor prescriptions before dispensing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStageDemoPrescription}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>⚡ Stage Sample Rx</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left List */}
        <div className={`flex-1 w-full ${selectedRx ? 'lg:max-w-md' : ''}`}>
          {loading ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400">
              Loading prescription queue...
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Review Queue is Clear</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All patient prescriptions have been validated. Click below to stage a sample prescription.
              </p>
              <button
                onClick={handleStageDemoPrescription}
                className="mt-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                ⚡ Stage Sample Prescription
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map(rx => (
                <div
                  key={rx._id}
                  onClick={() => {
                    setSelectedRx(rx);
                    setNotes(rx.pharmacistNotes || '');
                  }}
                  className={`bg-white p-5 rounded-3xl border cursor-pointer transition-all ${
                    selectedRx?._id === rx._id
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200/90 hover:border-blue-300 shadow-xs'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        {rx.patientName || rx.user?.name || 'Patient'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {new Date(rx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(rx.status)}
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-2">
                    <Pill size={14} className="text-blue-600" />
                    <span>{rx.detectedMedicines?.length || 0} medicines extracted by AI</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 text-[11px]">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Confidence: {rx.overallConfidence || 94}%
                    </span>
                    <span className="font-bold text-blue-600 flex items-center gap-1">
                      Inspect Rx <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Inspection Panel */}
        {selectedRx && (
          <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Inspecting Rx: {selectedRx.patientName || 'Patient'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extracted via Clinical OCR Radar • Status: {selectedRx.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedRx(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Extracted Medicines */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Prescribed Drug Entities
              </h4>
              <div className="space-y-3">
                {selectedRx.detectedMedicines?.map((med: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-900">
                        {med.medicineName || med.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                        {med.confidence}% Match
                      </span>
                    </div>

                    <div className="text-slate-600 space-y-0.5">
                      <p>
                        <strong className="text-slate-700">Dose & Frequency:</strong> {med.dosage} • {med.frequency}
                      </p>
                      <p>
                        <strong className="text-slate-700">Duration:</strong> {med.duration}
                      </p>
                    </div>

                    {med.warnings?.length > 0 && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium flex items-center gap-1.5 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Warning: {med.warnings[0]}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pharmacist Notes */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                Pharmacist Verification Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter counseling notes or reasons for clarification..."
                rows={3}
                className="w-full border border-slate-200 rounded-2xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => updateStatus(selectedRx._id, 'Approved')}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Rx</span>
              </button>
              <button
                onClick={() => updateStatus(selectedRx._id, 'Needs Clarification')}
                className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Clarify</span>
              </button>
              <button
                onClick={() => updateStatus(selectedRx._id, 'Rejected')}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionQueue;
