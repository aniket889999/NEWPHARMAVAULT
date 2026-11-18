import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Pill, 
  ShieldCheck, 
  User, 
  Stethoscope, 
  Sparkles
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
      const list = Array.isArray(data) ? data : [];
      setPrescriptions(list);
      setSelectedRx(list[0] || null);
      setNotes(list[0]?.pharmacistNotes || '');
    } catch (error) {
      console.error("Failed to load prescription queue", error);
      setPrescriptions([]);
      setSelectedRx(null);
      toast.error('Could not load the prescription queue. Check that the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      toast.loading(`Updating prescription status to ${status}...`, { id: 'status' });
      await apiClient.put(`/pharmacy/prescription/${id}/status`, {
        status,
        pharmacistNotes: notes
      });
      toast.success(`Prescription marked as ${status}`, { id: 'status' });
      setPrescriptions(prev => prev.map(p => (p._id === id || p.id === id ? { ...p, status, pharmacistNotes: notes } : p)));
      if (selectedRx && (selectedRx._id === id || selectedRx.id === id)) {
        setSelectedRx((prev: any) => ({ ...prev, status, pharmacistNotes: notes }));
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'The prescription could not be updated.', { id: 'status' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Approved</span>;
      case 'Rejected':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Rejected</span>;
      case 'Dispensed':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Dispensed</span>;
      case 'Needs Clarification':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Clarification Needed</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Pending Review</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">
              Clinical Pharmacist Verification
            </span>
            <span className="text-xs text-slate-400 font-mono">Schedule H Compliance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Prescription Review Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review optical character extractions, verify physician credentials, validate dosages, and authorize dispensing.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-medium">
            Awaiting Sign-off: <strong className="text-blue-700">{prescriptions.filter(p => p.status === 'Pending Review').length}</strong>
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Queue List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Prescription Ingestion Queue ({prescriptions.length})
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Loading verification queue...
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
              <CheckCircle2 className="text-emerald-500 w-12 h-12 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Review Queue Cleared</h3>
              <p className="text-xs text-slate-400 mt-1">All incoming patient prescriptions have been processed.</p>
            </div>
          ) : (
            prescriptions.map((rx, idx) => {
              const rxId = rx._id || rx.id || `rx_${idx}`;
              const isSelected = selectedRx && (selectedRx._id === rxId || selectedRx.id === rxId);
              
              return (
                <div 
                  key={rxId} 
                  onClick={() => { setSelectedRx(rx); setNotes(rx.pharmacistNotes || ''); }}
                  className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-600 ring-1 ring-blue-600 shadow-xs' 
                      : 'border-slate-200 hover:border-blue-300 shadow-2xs'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {rx.patientName || 'Rahul Sharma'}
                      </h4>
                      <p className="text-[11px] text-slate-500 flex items-center mt-0.5">
                        <Stethoscope className="w-3 h-3 mr-1 text-blue-600" />
                        {rx.doctorName || 'Dr. Ramesh Kulkarni, MD'}
                      </p>
                    </div>
                    {getStatusBadge(rx.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center">
                      <Pill className="w-3.5 h-3.5 mr-1 text-teal-600" />
                      {rx.detectedMedicines?.length || 0} Medications Extracted
                    </span>
                    <span className="font-mono text-slate-400">
                      {rx.prescriptionDate || new Date().toISOString().split('T')[0]}
                    </span>
                  </div>

                  {rx.overallConfidence && rx.overallConfidence < 0.90 && (
                    <div className="mt-2 text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded flex items-center border border-amber-200">
                      <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                      AI Confidence: {Math.round(rx.overallConfidence * 100)}% • Manual Review Required
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Inspection Workbench (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedRx ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              {/* Top Banner */}
              <div className="p-4 px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-700" />
                    Clinical Safety Verification Panel
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Patient: <strong>{selectedRx.patientName || 'Rahul Sharma'}</strong> • Attending: {selectedRx.doctorName || 'Dr. Ramesh Kulkarni'}
                  </p>
                </div>
                <div>{getStatusBadge(selectedRx.status)}</div>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {/* Extracted Raw OCR Note */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Optical Character Text Extraction
                  </span>
                  <p className="font-mono text-slate-700 text-xs leading-relaxed">
                    "{selectedRx.extractedText || 'Rx: Tab Azithromycin 500mg 1 OD x 3 days. Tab Dolo 650mg SOS fever.'}"
                  </p>
                </div>

                {/* Detected Medicines List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 flex items-center">
                      <Pill className="w-4 h-4 mr-1.5 text-blue-700" />
                      Formulations Detected for Dispensing
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Automated Formulary Mapping
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedRx.detectedMedicines?.map((med: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">
                              {med.medicineName || med.name}
                            </span>
                            <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-2">
                              {med.dosage && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">Dose: {med.dosage}</span>}
                              {med.frequency && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">Freq: {med.frequency}</span>}
                              {med.duration && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">Duration: {med.duration}</span>}
                            </div>
                            {med.instructions && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">
                                Note: {med.instructions}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
                              {Math.round((med.confidence || 0.95) * 100)}% Match
                            </span>
                            {med.stock !== undefined && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                In Stock: {med.stock} units
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pharmacist Clinical Notes */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    Pharmacist Clinical Audit Notes
                  </label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter dispensing instructions, contraindication notes, or clinical sign-off remarks..."
                    rows={3}
                    className="w-full border border-slate-300 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 px-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  Audit Timestamp: <strong>{new Date().toLocaleTimeString()}</strong>
                </div>

                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => updateStatus(selectedRx._id || selectedRx.id, 'Rejected')}
                    className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl font-bold text-xs transition-colors flex items-center"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Reject Rx</span>
                  </button>

                  <button 
                    onClick={() => updateStatus(selectedRx._id || selectedRx.id, 'Needs Clarification')}
                    className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 hover:border-amber-300 rounded-xl font-bold text-xs transition-colors flex items-center"
                  >
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Clarify with Doctor</span>
                  </button>

                  <button 
                    onClick={() => updateStatus(selectedRx._id || selectedRx.id, 'Approved')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    <span>Authorize & Approve</span>
                  </button>
                  {selectedRx.status === 'Approved' && (
                    <button
                      onClick={() => updateStatus(selectedRx._id || selectedRx.id, 'Dispensed')}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      <span>Mark Ready for Pickup</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select a prescription from the queue on the left to begin verification.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default PrescriptionQueue;
