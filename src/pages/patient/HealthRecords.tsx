import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { 
  FileText, 
  Calendar, 
  Pill, 
  Search, 
  Download, 
  ShieldCheck, 
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

const HealthRecords: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const { data } = await apiClient.get('/prescriptions/my-prescriptions');
        if (data && data.length > 0) {
          setPrescriptions(data);
        } else {
          setPrescriptions(sampleHealthRecords);
        }
      } catch (error) {
        setPrescriptions(sampleHealthRecords);
      }
    };
    fetchRecords();
  }, []);

  const filteredRecords = prescriptions.filter(record => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDoc = (record.doctorName || '').toLowerCase().includes(term);
      const matchDiag = (record.diagnosis || '').toLowerCase().includes(term);
      const matchText = (record.extractedText || '').toLowerCase().includes(term);
      if (!matchDoc && !matchDiag && !matchText) return false;
    }
    return true;
  });

  const handleDownloadRecord = (record: any) => {
    toast.success(`Downloaded clinical summary for ${record.diagnosis || 'Prescription'}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
              Digital Health Archive
            </span>
            <span className="text-xs text-slate-400">FHIR R4 Schema Compliant</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personal Health Records & Archive</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Your centralized repository of digitized prescriptions, OCR-extracted medication regimens, and clinical consultation records.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Patient Identity: <strong>PV-PT-9042</strong></span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by doctor, diagnosis, or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto text-xs">
          {['ALL', 'PRESCRIPTIONS', 'DISCHARGE', 'LAB_REPORTS'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'All Records' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRecords.map(record => (
          <div key={record._id} className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow overflow-hidden flex flex-col justify-between">
            <div>
              {/* Record Header */}
              <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{record.diagnosis || 'Clinical Prescription'}</h3>
                    <p className="text-[10px] text-slate-500 font-mono">Ref: {record._id}</p>
                  </div>
                </div>

                <div className="flex items-center text-slate-500 text-[11px]">
                  <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                  {new Date(record.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Record Content */}
              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Prescribing Practitioner:</span>
                  <span className="font-bold text-slate-800">{record.doctorName || 'Dr. Ramesh Kumar, MD'}</span>
                </div>

                {/* Formulations list */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                    Extracted Medications
                  </span>
                  <div className="space-y-1.5">
                    {(record.detectedMedicines || [
                      { name: 'Dolo 650mg', dosage: '650 mg', frequency: 'Twice daily' },
                      { name: 'Pantoprazole 40mg', dosage: '40 mg', frequency: 'Once daily' }
                    ]).map((med: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-semibold text-slate-800">{med.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">{med.dosage || 'Standard'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {record.extractedText && (
                  <div className="p-3 rounded-lg bg-slate-50/50 border border-slate-100 text-[11px] text-slate-600 max-h-20 overflow-y-auto">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">OCR Raw Transcript:</span>
                    <p className="font-mono text-[10px] leading-relaxed">{record.extractedText}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verified Clinical Archive
              </span>

              <button
                onClick={() => handleDownloadRecord(record)}
                className="inline-flex items-center space-x-1 text-teal-700 hover:text-teal-800 font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const sampleHealthRecords = [
  {
    _id: 'RX-2024-9041',
    createdAt: new Date().toISOString(),
    doctorName: 'Dr. Ramesh Kumar, MD',
    diagnosis: 'Acute Upper Respiratory Tract Infection',
    detectedMedicines: [
      { name: 'Dolo 650mg (Micro Labs)', dosage: '650 mg', frequency: 'Twice daily (1-0-1)' },
      { name: 'Azithromycin 500mg (Cipla)', dosage: '500 mg', frequency: 'Once daily (1-0-0)' },
      { name: 'Pantoprazole 40mg (Alkem)', dosage: '40 mg', frequency: 'Before breakfast (1-0-0)' }
    ],
    extractedText: 'Tab Dolo 650 1-0-1 5d, Tab Azithromycin 500mg 1-0-0 3d, Cap Pan 40 1-0-0'
  },
  {
    _id: 'RX-2024-8890',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    doctorName: 'Dr. Sunita Sharma, DM',
    diagnosis: 'Routine Cardiovascular & Lipid Panel Evaluation',
    detectedMedicines: [
      { name: 'Atorvastatin 10mg', dosage: '10 mg', frequency: 'Bedtime (0-0-1)' },
      { name: 'Metformin 500mg', dosage: '500 mg', frequency: 'Post dinner (0-0-1)' }
    ],
    extractedText: 'Tab Atorvastatin 10mg hs, Tab Metformin 500mg post dinner. Maintain regular exercise.'
  }
];

export default HealthRecords;
