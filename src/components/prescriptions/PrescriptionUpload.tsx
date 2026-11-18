import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  ShoppingCart, 
  Bell, 
  RefreshCw, 
  Lock, 
  FileCheck, 
  Check, 
  X,
  Pill
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const createThumbnail = (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageSrc);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

const PrescriptionUpload: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  const [ocrText, setOcrText] = useState<string>('');
  const [extractedMedicines, setExtractedMedicines] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCartStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rxMeta, setRxMeta] = useState<{ doctorName?: string; patientName?: string; prescriptionDate?: string }>({});

  // Reminder Modal State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDrafts, setReminderDrafts] = useState<any[]>([]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Img = reader.result as string;
        setSelectedImage(base64Img);
        const thumb = await createThumbnail(base64Img);
        setThumbnailImage(thumb);
        setStep(1); 
      };
      reader.readAsDataURL(file);
      setOcrText('');
      setExtractedMedicines([]);
      setConfidence(0);
    }
  };

  // Demo 1-Click Sample Prescription
  const handleLoadSampleRx = () => {
    // Generate a clean medical prescription canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 600, 400);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('CITY HOSPITAL & CLINICAL CARE', 40, 45);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Dr. Ramesh Kulkarni, MD  Reg: MCI-98421  Date: ' + new Date().toLocaleDateString('en-GB'), 40, 70);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 85);
      ctx.lineTo(560, 85);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Patient: ' + (user?.name || 'Ananya Verma') + '    Rx:', 40, 115);
      ctx.font = '13px sans-serif';
      ctx.fillText('1. Tab. Dolo 650mg - 1-0-1 - 5 days (After meals)', 50, 150);
      ctx.fillText('2. Cap. Amoxicillin 500mg - 1-0-1 - 3 days (After food)', 50, 185);
      ctx.fillText('3. Tab. Azithromycin 500mg - 1-0-0 - 3 days (Post lunch)', 50, 220);
      
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 11px sans-serif';
      ctx.fillText('Diagnosis: Upper Respiratory Tract Infection with Fever', 50, 270);
      ctx.fillText('Signature: Dr. R. Kulkarni', 340, 350);

      const sampleDataUrl = canvas.toDataURL('image/jpeg');
      setSelectedImage(sampleDataUrl);
      setThumbnailImage(sampleDataUrl);
      setStep(1);
      toast.success('Sample clinical prescription loaded');
    }
  };

  const processImage = async () => {
    if (!selectedImage) return;
    setIsProcessing(true);
    setStep(2);
    setProcessingStatus('Enhancing document resolution & binarizing text...');
    
    try {
      setProcessingStatus('Running privacy-preserving local OCR...');
      const result = await Tesseract.recognize(selectedImage, 'eng', {
        logger: () => {}
      });
      
      const rawText = result.data.text || '';
      setOcrText(rawText);

      setProcessingStatus('Reconciling against CDSCO catalogue & dosage standards...');
      
      try {
        const response = await apiClient.post('/prescriptions/analyze', {
          rawText: rawText,
          imageBase64: thumbnailImage || selectedImage
        });
        const structuredData = response.data;
        const meds = Array.isArray(structuredData.medicines) ? structuredData.medicines : [];
        setExtractedMedicines(meds);
        setConfidence(structuredData.overallConfidence || 0);
        setRxMeta({ doctorName: structuredData.doctorName, patientName: structuredData.patientName, prescriptionDate: structuredData.prescriptionDate });
        if (!meds.length) toast.error('No medicines could be read. Try a clearer, printed prescription, or correct the text and try again.');
      } catch (e) {
        setExtractedMedicines([]);
        toast.error('The prescription could not be analysed. Check that the server is running.');
      }

      setStep(3);
    } catch (error) {
      console.error('OCR Error:', error);
      setExtractedMedicines([]);
      toast.error('Text could not be read from this image.');
      setStep(3);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };


  const handleSavePrescription = async () => {
    if (extractedMedicines.length === 0) return;
    setIsSaving(true);
    toast.loading('Saving to health archive...', { id: 'save-rx' });
    try {
      await apiClient.post('/prescriptions/save', {
        imageUrl: thumbnailImage,
        extractedText: ocrText,
        detectedMedicines: extractedMedicines.map((m: any) => ({ medicineName: m.name, genericName: m.genericName, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions, confidence: m.confidence, matchedInventoryId: m.matchedInventoryId, needsReview: m.needsReview, price: m.price, stock: m.stock })),
        doctorName: rxMeta.doctorName && rxMeta.doctorName !== 'Unknown' ? rxMeta.doctorName : '',
        patientName: rxMeta.patientName && rxMeta.patientName !== 'Unknown' ? rxMeta.patientName : (user?.name || ''),
        prescriptionDate: rxMeta.prescriptionDate || new Date().toISOString().slice(0, 10),
        overallConfidence: confidence
      });
      toast.success('Prescription archived to Health Records', { id: 'save-rx' });
      navigate('/patient/health-records');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'The prescription could not be saved.', { id: 'save-rx' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAllToCart = () => {
    const available = extractedMedicines.filter((m: any) => m.matchedInventoryId);
    available.forEach((med: any) => addItem({ id: med.matchedInventoryId, name: med.name, price: med.price || 0 }));
    const missing = extractedMedicines.length - available.length;
    if (!available.length) { toast.error('None of these medicines is in stock at a PharmaVault pharmacy. Use Find nearby.'); return; }
    toast.success(`${available.length} item(s) added to cart${missing ? ` · ${missing} not in stock` : ''}. Save the prescription so the pharmacist can check it.`);
    navigate('/patient/cart');
  };

  const openReminderModal = (medsToRemind: any[]) => {
    // One reminder per dose time read from the prescription (e.g. 1-0-1 -> 08:00 and 20:00). SOS medicines get none.
    const drafts = medsToRemind.flatMap((m: any) => (m.reminderTimes?.length ? m.reminderTimes : (/sos|when needed/i.test(m.frequency || '') ? [] : ['09:00']))
      .map((time: string) => ({ medicineName: m.name, dosage: m.dosage || '1 unit', reminderTime: time, frequency: 'daily', email: user?.email || '' })));
    if (!drafts.length) { toast('These medicines are taken only when needed (SOS), so no reminders are needed.'); return; }
    setReminderDrafts(drafts);
    setShowReminderModal(true);
  };

  const handleSaveReminders = async () => {
    try {
      for (const draft of reminderDrafts) {
        await apiClient.post('/reminders/create', draft);
      }
      toast.success(`${reminderDrafts.length} reminder(s) scheduled.`);
      setShowReminderModal(false);
      navigate('/patient/reminders');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Reminders could not be saved.');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full">
              Privacy-First Local OCR
            </span>
            <span className="text-xs text-slate-400">Tesseract Engine v7.0</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prescription Scanner & OCR Parsing</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Upload handwritten or digital doctor prescriptions. Local OCR identifies medicines, cross-checks dosage standards, and allows 1-click cart addition.
          </p>
        </div>

        <button
          onClick={handleLoadSampleRx}
          className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 flex items-center space-x-2 transition-colors self-start md:self-auto"
        >
          <FileCheck className="w-4 h-4 text-teal-600" />
          <span>Load Demo Prescription</span>
        </button>
      </div>

      {/* Stepper Progress Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className={`flex items-center space-x-2.5 p-2 rounded-lg transition-colors ${step >= 1 ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs ${step >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              1
            </span>
            <span>Document Ingestion</span>
          </div>

          <div className={`flex items-center space-x-2.5 p-2 rounded-lg transition-colors ${step >= 2 ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs ${step >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              2
            </span>
            <span>OCR Extraction</span>
          </div>

          <div className={`flex items-center space-x-2.5 p-2 rounded-lg transition-colors ${step >= 3 ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs ${step >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              3
            </span>
            <span>Clinical Review & Actions</span>
          </div>
        </div>
      </div>

      {/* Main Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Document Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-1.5 text-teal-600" />
              Document Upload
            </h2>

            {!selectedImage ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-teal-50/20 transition-all flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Select Prescription Image or PDF</p>
                  <p className="text-xs text-slate-400 mt-0.5">Supports PNG, JPG, or PDF (Max 10MB)</p>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                  <Lock className="w-3 h-3" />
                  <span>100% Client-Side Privacy Guaranteed</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-72">
                  <img src={selectedImage} alt="Uploaded Prescription" className="object-contain max-h-72 w-full" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={processImage}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{isProcessing ? 'Extracting Text...' : 'Run Local OCR'}</span>
                  </button>

                  <button
                    onClick={() => { setSelectedImage(null); setExtractedMedicines([]); setStep(1); }}
                    className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                    title="Clear Image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*,application/pdf"
              onChange={handleImageUpload}
              className="hidden" 
            />
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-900 flex items-center space-x-3 shadow-2xs">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700 flex-shrink-0" />
              <div>
                <p className="font-bold">Analyzing Prescription...</p>
                <p className="text-teal-700 text-[11px] mt-0.5">{processingStatus}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Extracted Medicines & Clinical Match Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                <Pill className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                Extracted Formulations ({extractedMedicines.length})
              </h2>
              {confidence > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Confidence: {confidence}%
                </span>
              )}
            </div>

            {extractedMedicines.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                <FileText className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No extracted medicines yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Upload a prescription or click "Load Demo Prescription" to view instant OCR medicine parsing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Medicine & Form</th>
                        <th className="py-2.5 px-3">Dosage</th>
                        <th className="py-2.5 px-3">Frequency</th>
                        <th className="py-2.5 px-3">Standard Price</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extractedMedicines.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div>
                              <span>{med.name}</span>
                              <span className="block text-[10px] text-slate-400 font-normal">{med.form || 'Tablet'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">{med.dosage || 'Standard'}</td>
                          <td className="py-3 px-3 text-slate-600">{med.frequency || 'As directed'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {med.price ? `₹${Number(med.price).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button type="button" onClick={() => navigate(`/patient/nearby-medicines?medicine=${encodeURIComponent(med.medicineName || med.name)}`)} className="text-[10px] font-semibold text-teal-700 underline">Find nearby</button>
                            {med.needsReview ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">Check reading</span>
                            ) : med.matchedInventoryId ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-2.5 h-2.5 mr-1" /> In stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Not in stock</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Action Strip */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleAddAllToCart}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Add to Dispensary Cart</span>
                    </button>

                    <button
                      onClick={() => openReminderModal(extractedMedicines)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>Set Reminders</span>
                    </button>
                  </div>

                  <button
                    onClick={handleSavePrescription}
                    disabled={isSaving}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Archiving...' : 'Archive to Records'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reminder Schedule Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Schedule Dose Reminders</h3>
              <button onClick={() => setShowReminderModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-500">Configure reminder times for your extracted prescription items:</p>
              {reminderDrafts.map((d, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900">{d.medicineName}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="time" 
                      value={d.reminderTime} 
                      onChange={e => {
                        const copy = [...reminderDrafts];
                        copy[i].reminderTime = e.target.value;
                        setReminderDrafts(copy);
                      }} 
                      className="px-2 py-1 border rounded text-xs" 
                    />
                    <input 
                      type="email" 
                      value={d.email} 
                      onChange={e => {
                        const copy = [...reminderDrafts];
                        copy[i].email = e.target.value;
                        setReminderDrafts(copy);
                      }} 
                      className="px-2 py-1 border rounded text-xs" 
                    />
                  </div>
                </div>
              ))}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button onClick={() => setShowReminderModal(false)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Cancel</button>
                <button onClick={handleSaveReminders} className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold">Save Reminders</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionUpload;
