import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Upload, FileText, CheckCircle, AlertTriangle, X, ShoppingCart, Info, ScanText, Search, Edit2, Bell, ChevronRight } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import toast from 'react-hot-toast';

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

// Creates a downscaled preview image for saving to Database (avoids massive base64 strings)
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
      resolve(canvas.toDataURL('image/jpeg', 0.6)); // compressed JPEG
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

// Enhances image specifically for OCR processing
const preprocessImageForOCR = (imageSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 1.5;
      canvas.height = img.height * 1.5;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageSrc);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
        const contrast = 120;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        let finalBrightness = factor * (brightness - 128) + 128;
        const bw = finalBrightness > 150 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
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
  const [cleanedText, setCleanedText] = useState<string>('');
  const [extractedMedicines, setExtractedMedicines] = useState<any[]>([]);
  const [unknownWords, setUnknownWords] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [isVisionFallback, setIsVisionFallback] = useState(false);
  
  // UI States
  const [step, setStep] = useState(1);
  const [showManualCorrection, setShowManualCorrection] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCartStore();
  const navigate = useNavigate();

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
        // Create thumbnail immediately for saving later to avoid payload limits
        const thumb = await createThumbnail(base64Img);
        setThumbnailImage(thumb);
        setStep(1); 
      };
      reader.readAsDataURL(file);
      
      setOcrText('');
      setCleanedText('');
      setExtractedMedicines([]);
      setUnknownWords([]);
      setConfidence(0);
      setIsVisionFallback(false);
      setShowManualCorrection(false);
    }
  };

  const processImage = async () => {
    if (!selectedImage) return;
    setIsProcessing(true);
    setStep(2);
    setProcessingStatus('Enhancing image quality...');
    
    try {
      const processedImageSrc = await preprocessImageForOCR(selectedImage);

      setProcessingStatus('Running Local Tesseract OCR Engine...');
      const result = await Tesseract.recognize(processedImageSrc, 'eng', {
        logger: m => console.log(m)
      });
      
      let rawText = result.data.text;
      setOcrText(rawText);

      setProcessingStatus('Connecting to AI Prescription Intelligence...');
      
      // Use the new structured extraction API
      const response = await apiClient.post('/prescriptions/analyze', {
        rawText: rawText,
        imageBase64: thumbnailImage || selectedImage
      });

      const structuredData = response.data;
      
      setExtractedMedicines(structuredData.medicines || []);
      setConfidence(structuredData.overallConfidence || 0);
      setStep(3); // Move to structured review step
      
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error('Failed to process image. Please try again.');
      setStep(1);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleSavePrescription = async () => {
    if (extractedMedicines.length === 0) return;
    setIsSaving(true);
    toast.loading('Saving prescription...', { id: 'save-rx' });
    try {
      await apiClient.post('/prescriptions/save', {
        imageUrl: thumbnailImage, // Saved the compressed thumbnail
        extractedText: ocrText,
        detectedMedicines: extractedMedicines
      });
      toast.success('Prescription saved to Health Records!', { id: 'save-rx' });
      navigate('/patient/health-records');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save prescription. Check console for details.', { id: 'save-rx' });
    } finally {
      setIsSaving(false);
    }
  };

  const openReminderModal = (medsToRemind: any[]) => {
    const drafts = medsToRemind.map(m => ({
      medicineName: m.name,
      dosage: '',
      reminderTime: '',
      frequency: 'daily',
      email: ''
    }));
    setReminderDrafts(drafts);
    setShowReminderModal(true);
  };

  const handleSaveReminders = async () => {
    try {
      for (const draft of reminderDrafts) {
        if (!draft.reminderTime || !draft.email) {
          toast.error(`Please fill time and email for ${draft.medicineName}`, { id: 'reminders' });
          return;
        }
        await apiClient.post('/reminders/create', draft);
      }
      toast.success('Reminders saved & emails scheduled!', { id: 'reminders' });
      setShowReminderModal(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create some reminders', { id: 'reminders' });
    }
  };

  const handleManualAdd = (med: any) => {
    if (!extractedMedicines.some(m => m.id === med._id)) {
      setExtractedMedicines([...extractedMedicines, {
        id: med._id,
        name: med.name,
        price: med.price,
        stock: med.stock,
        qty: 1,
        description: med.description,
        prescriptionRequired: med.prescriptionRequired
      }]);
    }
    setManualSearchQuery('');
  };

  const manualSearchResults = inventoryList.filter(med => 
    med.name.toLowerCase().includes(manualSearchQuery.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Smart Prescription AI</h1>
        <p className="text-gray-500 mt-1">Upload your prescription. Our AI extracts medicines, saves your health record, and sets up email reminders.</p>
      </div>

      {/* STEP INDICATOR */}
      <div className="flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className={`flex items-center ${step >= 1 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${step >= 1 ? 'bg-indigo-100' : 'bg-gray-100'}`}>1</div> Upload
        </div>
        <ChevronRight className="text-gray-300" />
        <div className={`flex items-center ${step >= 2 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${step >= 2 ? 'bg-indigo-100' : 'bg-gray-100'}`}>2</div> Processing
        </div>
        <ChevronRight className="text-gray-300" />
        <div className={`flex items-center ${step >= 3 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${step >= 3 ? 'bg-indigo-100' : 'bg-gray-100'}`}>3</div> Review & Save
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md border-2 border-dashed border-indigo-300 rounded-2xl h-80 flex flex-col items-center justify-center bg-indigo-50 cursor-pointer hover:bg-indigo-100 transition-colors relative overflow-hidden"
            >
              {selectedImage ? (
                <img src={selectedImage} alt="Prescription preview" className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <>
                  <Upload size={48} className="text-indigo-500 mb-4" />
                  <p className="font-bold text-indigo-900 text-lg">Click to upload prescription</p>
                  <p className="text-sm text-indigo-500 mt-2">JPG, PNG, PDF up to 5MB</p>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
            </div>
            
            {selectedImage && (
              <button 
                onClick={processImage}
                className="mt-8 bg-indigo-600 text-white font-bold px-12 py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-md flex items-center"
              >
                <ScanText className="mr-2" /> Start AI Extraction
              </button>
            )}
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && isProcessing && (
          <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-6"></div>
            <h2 className="text-xl font-bold">{processingStatus}</h2>
            <p className="text-gray-500 mt-2 text-center max-w-sm">We are analyzing the handwriting and matching it against our certified medicine database.</p>
          </div>
        )}

        {/* Step 3: Review & Actions */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Extraction Results */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                  <CheckCircle className="mr-2 text-green-500" size={18} /> Verified Medicine Matches
                </h3>
                
                {extractedMedicines.length === 0 ? (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-center">
                    <AlertTriangle className="text-red-400 w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm font-bold text-red-800">No exact medicines found.</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {extractedMedicines.map((med, idx) => (
                      <li key={idx} className={`bg-white p-4 rounded-xl border ${med.needsReview ? 'border-yellow-400 shadow-yellow-100' : 'border-gray-200'} shadow-sm relative`}>
                        <button 
                          onClick={() => setExtractedMedicines(extractedMedicines.filter((_, i) => i !== idx))}
                          className="absolute top-3 right-3 text-red-400 hover:bg-red-50 rounded-full p-1 transition-colors"
                        >
                          <X size={16} />
                        </button>
                        <div className="pr-8">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900 text-lg">{med.medicineName || med.name}</p>
                            {med.confidence && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${med.confidence > 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {med.confidence}% Match
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mb-3">
                            <p><span className="font-semibold text-gray-500">Dosage:</span> {med.dosage || 'N/A'}</p>
                            <p><span className="font-semibold text-gray-500">Freq:</span> {med.frequency || 'N/A'}</p>
                            <p><span className="font-semibold text-gray-500">Duration:</span> {med.duration || 'N/A'}</p>
                            <p><span className="font-semibold text-gray-500">Inst:</span> {med.instructions || 'N/A'}</p>
                          </div>

                          <p className="text-sm text-gray-500 mb-3 font-semibold text-indigo-600">
                            ₹{(med.price || 0).toFixed(2)} | Stock: {med.stock || 0}
                          </p>

                          {med.warnings && med.warnings.length > 0 && (
                            <div className="mb-3 text-[11px] text-red-700 bg-red-50 p-2 rounded border border-red-100">
                              <span className="font-bold flex items-center"><AlertTriangle size={12} className="mr-1"/> Safety Warning:</span>
                              <ul className="list-disc pl-4 mt-1">
                                {med.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                              </ul>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button 
                              onClick={() => openReminderModal([{
                                name: med.medicineName || med.name,
                                dosage: med.dosage
                              }])}
                              className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex items-center transition-colors"
                            >
                              <Bell size={14} className="mr-1" /> Add Reminder
                            </button>
                            <button 
                              onClick={() => {
                                addItem({ id: med.matchedInventoryId || med.id || 'unknown', name: med.medicineName || med.name, price: med.price || 0, quantity: 1 });
                                toast.success('Added to cart!');
                              }}
                              className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-bold hover:bg-green-100 flex items-center transition-colors"
                            >
                              <ShoppingCart size={14} className="mr-1" /> Add to Cart
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center">
                    <Search size={14} className="mr-1"/> Add Missing Medicine Manually:
                  </h4>
                  <input 
                    type="text" 
                    placeholder="Search database..." 
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {manualSearchQuery && (
                    <ul className="mt-2 bg-white border border-gray-200 rounded-lg shadow-sm max-h-40 overflow-y-auto">
                      {manualSearchResults.length > 0 ? manualSearchResults.map(med => (
                        <li key={med._id} className="p-2 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                          <span className="text-sm font-medium">{med.name}</span>
                          <button onClick={() => handleManualAdd(med)} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200">Add</button>
                        </li>
                      )) : <li className="p-2 text-xs text-gray-500">No matches found.</li>}
                    </ul>
                  )}
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-xs text-yellow-800 flex items-start font-bold">
                <AlertTriangle size={18} className="mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p>Please verify all extracted medicines manually. OCR technology is not 100% accurate and should not replace professional medical advice.</p>
              </div>
            </div>

            {/* Right Column: Actions & Raw Data */}
            <div className="flex flex-col space-y-6">
              {/* Primary Actions */}
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col gap-3">
                <h3 className="font-bold text-indigo-900 text-lg mb-2">Finalize Prescription</h3>
                <button 
                  onClick={handleSavePrescription}
                  disabled={extractedMedicines.length === 0 || isSaving}
                  className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm"
                >
                  <FileText size={20} className="mr-2" /> Save to Health Records
                </button>
                <button 
                  onClick={() => openReminderModal(extractedMedicines)}
                  disabled={extractedMedicines.length === 0}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 flex items-center justify-center disabled:opacity-50 transition-colors"
                >
                  <Bell size={20} className="mr-2" /> Add All to Smart Reminders
                </button>
              </div>

              {/* Debug Data Drawer */}
              <div className="bg-gray-900 p-4 rounded-xl text-gray-300">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Raw Data (For Verification)</h3>
                <div className="text-[10px] font-mono whitespace-pre-wrap overflow-y-auto max-h-32 bg-black/50 p-3 rounded-lg border border-gray-800">
                  {ocrText || "No text extracted."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reminder Modal Overlay */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-indigo-600 text-white shrink-0">
              <h2 className="font-bold flex items-center text-xl"><Bell className="mr-2" /> Schedule Email Reminders</h2>
              <button onClick={() => setShowReminderModal(false)} className="hover:bg-indigo-700 p-1.5 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50">
              {reminderDrafts.map((draft, idx) => (
                <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-indigo-900 mb-4 text-lg border-b border-gray-100 pb-2">{draft.medicineName}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Dosage / Instructions</label>
                      <input 
                        value={draft.dosage} 
                        onChange={e => {
                          const newDrafts = [...reminderDrafts];
                          newDrafts[idx].dosage = e.target.value;
                          setReminderDrafts(newDrafts);
                        }} 
                        type="text" 
                        placeholder="e.g. 1 pill after meal"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Reminder Time</label>
                      <input 
                        value={draft.reminderTime} 
                        onChange={e => {
                          const newDrafts = [...reminderDrafts];
                          newDrafts[idx].reminderTime = e.target.value;
                          setReminderDrafts(newDrafts);
                        }} 
                        type="time" 
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Frequency</label>
                      <select 
                        value={draft.frequency} 
                        onChange={e => {
                          const newDrafts = [...reminderDrafts];
                          newDrafts[idx].frequency = e.target.value;
                          setReminderDrafts(newDrafts);
                        }} 
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Alert Email Address</label>
                      <input 
                        value={draft.email} 
                        onChange={e => {
                          const newDrafts = [...reminderDrafts];
                          newDrafts[idx].email = e.target.value;
                          setReminderDrafts(newDrafts);
                        }} 
                        type="email" 
                        placeholder="your@email.com"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-5 border-t bg-white shrink-0 flex gap-4">
              <button 
                onClick={() => setShowReminderModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveReminders}
                className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex justify-center items-center"
              >
                <CheckCircle className="mr-2" size={20} /> Save All Reminders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionUpload;
