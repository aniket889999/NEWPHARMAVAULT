import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { FileText, CheckCircle, XCircle, AlertCircle, Eye, Pill } from 'lucide-react';
import toast from 'react-hot-toast';

const PrescriptionQueue: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const fetchQueue = async () => {
    try {
      const { data } = await apiClient.get('/pharmacy/prescription-queue');
      setPrescriptions(data);
    } catch (error) {
      toast.error("Failed to load prescription queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      toast.loading('Updating status...', { id: 'status' });
      
      await apiClient.put(`/pharmacy/prescription/${id}/status`, {
        status,
        pharmacistNotes: notes
      });
      
      toast.success(`Prescription marked as ${status}`, { id: 'status' });
      setSelectedRx(null);
      setNotes('');
      fetchQueue();
    } catch (error) {
      toast.error('Failed to update status', { id: 'status' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Approved': return <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Approved</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">Rejected</span>;
      case 'Dispensed': return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Dispensed</span>;
      case 'Needs Clarification': return <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">Needs Clarification</span>;
      default: return <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">Pending Review</span>;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto flex gap-6">
      <div className={`flex-1 ${selectedRx ? 'hidden md:block' : ''}`}>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Prescription Review Queue</h1>
        <p className="text-gray-500 mb-8">Review AI-extracted patient prescriptions before dispensing.</p>

        {loading ? (
          <div className="text-center p-8 text-gray-500">Loading queue...</div>
        ) : prescriptions.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border text-center">
            <CheckCircle className="text-green-400 w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-700">Queue is empty!</h2>
            <p className="text-gray-500">All prescriptions have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx) => (
              <div 
                key={rx._id} 
                className={`bg-white p-5 rounded-xl border cursor-pointer transition-colors ${selectedRx?._id === rx._id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300 shadow-sm'}`}
                onClick={() => { setSelectedRx(rx); setNotes(rx.pharmacistNotes || ''); }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{rx.patientName || rx.user?.name || 'Patient'}</h3>
                    <p className="text-xs text-gray-500">{new Date(rx.createdAt).toLocaleDateString()}</p>
                  </div>
                  {getStatusBadge(rx.status)}
                </div>
                <div className="text-sm text-gray-600 flex items-center">
                  <Pill size={14} className="mr-1" /> {rx.detectedMedicines?.length || 0} medicines extracted
                </div>
                {rx.overallConfidence < 80 && (
                  <div className="mt-2 text-[10px] text-yellow-700 font-bold bg-yellow-50 px-2 py-1 rounded w-max">
                    <AlertCircle size={10} className="inline mr-1" /> Low AI Confidence - Verify Manually
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Panel */}
      {selectedRx && (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col h-[calc(100vh-100px)] sticky top-4">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-lg">Reviewing Prescription</h2>
            <button onClick={() => setSelectedRx(null)} className="text-gray-400 hover:text-gray-600 md:hidden"><XCircle size={20}/></button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {selectedRx.imageUrl && (
              <div className="border rounded-xl overflow-hidden bg-gray-100 mb-6 flex justify-center">
                <img src={selectedRx.imageUrl} alt="Prescription" className="max-h-64 object-contain" />
              </div>
            )}

            <div>
              <h3 className="font-bold text-gray-800 mb-3 border-b pb-1 flex items-center"><Pill size={16} className="mr-2"/> Extracted Medicines</h3>
              <ul className="space-y-3">
                {selectedRx.detectedMedicines.map((med: any, idx: number) => (
                  <li key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex justify-between font-bold text-gray-900 mb-1">
                      <span>{med.medicineName || med.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${med.confidence > 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {med.confidence}% Match
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      {med.dosage && <span>{med.dosage} </span>}
                      {med.frequency && <span>| {med.frequency} </span>}
                      {med.duration && <span>| {med.duration}</span>}
                    </div>
                    {med.warnings && med.warnings.length > 0 && (
                      <div className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded font-medium border border-red-100">
                        Warning: {med.warnings[0]}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 text-sm">Pharmacist Notes (Optional)</h3>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for the patient or internal record..."
                className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
              />
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 rounded-b-xl grid grid-cols-2 gap-3 shrink-0">
            {selectedRx.status === 'Pending Review' || selectedRx.status === 'Needs Clarification' ? (
              <>
                <button onClick={() => updateStatus(selectedRx._id, 'Approved')} className="bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 flex items-center justify-center"><CheckCircle size={16} className="mr-1"/> Approve</button>
                <button onClick={() => updateStatus(selectedRx._id, 'Needs Clarification')} className="bg-yellow-500 text-white font-bold py-2 rounded-lg hover:bg-yellow-600 flex items-center justify-center"><AlertCircle size={16} className="mr-1"/> Clarify</button>
                <button onClick={() => updateStatus(selectedRx._id, 'Rejected')} className="bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 flex items-center justify-center col-span-2"><XCircle size={16} className="mr-1"/> Reject</button>
              </>
            ) : selectedRx.status === 'Approved' ? (
              <button onClick={() => updateStatus(selectedRx._id, 'Dispensed')} className="bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center col-span-2">Mark as Dispensed</button>
            ) : (
              <div className="col-span-2 text-center text-gray-500 font-bold py-2">Status: {selectedRx.status}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionQueue;
