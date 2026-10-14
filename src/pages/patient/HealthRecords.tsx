import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { FileText, Calendar, Pill, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const HealthRecords: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const { data } = await apiClient.get('/prescriptions/my-prescriptions');
        setPrescriptions(data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load health records');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Health Records</h1>
          <p className="text-gray-600">Your digitized prescriptions and extracted medication history.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search records..." 
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading records...</div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center">
          <FileText className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-700">No Prescriptions Yet</h2>
          <p className="text-gray-500 mt-2">Upload a prescription via Smart OCR to start building your digitized health record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prescriptions.map((record) => (
            <div key={record._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                <div className="flex items-center text-gray-600 text-sm font-medium">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(record.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <button className="text-primary-600 hover:bg-primary-50 p-1.5 rounded transition-colors" title="Download Record">
                  <Download className="h-4 w-4" />
                </button>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                {(record.doctorName || record.patientName) && (
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-indigo-50 p-3 rounded-lg text-indigo-900 border border-indigo-100">
                    <div><span className="font-bold text-indigo-700">Doctor:</span> {record.doctorName || 'Unknown'}</div>
                    <div><span className="font-bold text-indigo-700">Patient:</span> {record.patientName || 'Unknown'}</div>
                    {record.overallConfidence > 0 && (
                      <div className="col-span-2 text-xs text-indigo-600">
                        AI Extraction Confidence: {record.overallConfidence}%
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 mb-4">
                  {record.imageUrl && (
                    <div className="w-24 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img src={record.imageUrl} alt="Prescription snippet" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 flex items-center mb-2">
                      <Pill className="h-4 w-4 mr-2 text-primary-600" />
                      Structured Medicines
                    </h3>
                    <ul className="space-y-3">
                      {record.detectedMedicines.map((med: any, idx: number) => (
                        <li key={idx} className="flex flex-col text-sm border-b pb-2 last:border-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">{med.medicineName || med.name}</span>
                            {med.confidence && <span className="text-[10px] text-gray-500">{med.confidence}% Match</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {med.dosage && <span>{med.dosage} </span>}
                            {med.frequency && <span>| {med.frequency} </span>}
                            {med.duration && <span>| {med.duration}</span>}
                          </div>
                          {med.warnings && med.warnings.length > 0 && (
                            <div className="text-[10px] mt-1 text-red-600 font-semibold bg-red-50 p-1 rounded">
                              {med.warnings[0]}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {record.extractedText && (
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Raw OCR Data</p>
                    <p className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded max-h-20 overflow-y-auto border border-gray-100">
                      {record.extractedText.substring(0, 150)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthRecords;
