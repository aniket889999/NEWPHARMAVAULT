import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificationApi } from '../api/verificationApi';
import { DocumentType, VerificationCase } from '../types';
import { VerificationNav } from '../components/VerificationNav';
import { LifecycleStepper } from '../components/LifecycleStepper';
import {
  FilePlus,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Cpu,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Single clear raw file limit: 5 MiB (5,242,880 bytes).
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
];

/**
 * Convert selected File to a base64 Data URI via FileReader.readAsDataURL().
 */
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URI'));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Error reading selected document file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * LOCAL DEVELOPMENT FIXTURE ONLY:
 * Synthetic demo PDF fixture is strictly for local testing & development.
 * It is dead-code eliminated in production builds (import.meta.env.DEV === true)
 * and MUST NEVER be used with real healthcare documents.
 */
const createDevPdfFixture = (filename: string): File => {
  const minimalPdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  return new File([minimalPdfContent], filename, { type: 'application/pdf' });
};

export const CreateCaseWizardPage: React.FC = () => {
  const navigate = useNavigate();

  // Step 1: Case Creation
  const [subjectRef, setSubjectRef] = useState<string>('');
  const [caseNotes, setCaseNotes] = useState<string>('');
  const [createdCase, setCreatedCase] = useState<VerificationCase | null>(null);
  const [isCreatingCase, setIsCreatingCase] = useState<boolean>(false);

  // Upload States for 3 Tri-Documents
  const [uploadedDocs, setUploadedDocs] = useState<Record<DocumentType, boolean>>({
    PRESCRIPTION: false,
    PHARMACY_INVOICE: false,
    CLAIM_FORM: false
  });
  const [uploadingDoc, setUploadingDoc] = useState<DocumentType | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Step 1: Submit Case Creation
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingCase(true);
      const newCase = await verificationApi.createCase(
        subjectRef.trim() || undefined,
        caseNotes ? { notes: caseNotes.trim() } : undefined
      );
      setCreatedCase(newCase);
      toast.success(`Verification case ${newCase.caseReference} created!`);
    } catch (err: any) {
      console.error('Case creation failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to initialize case';
      toast.error(msg);
    } finally {
      setIsCreatingCase(false);
    }
  };

  // Secure File Upload handler (reads actual bytes as data URI)
  const handleFileUpload = async (
    docType: DocumentType,
    fileObj: File
  ) => {
    if (!createdCase) return;

    if (!fileObj) {
      toast.error('A valid document file is required.');
      return;
    }

    // Validation: Empty file check
    if (fileObj.size === 0) {
      toast.error('The selected file is empty (0 bytes). Please choose a valid document.');
      return;
    }

    // Validation: Maximum file size check (5 MiB)
    if (fileObj.size > MAX_FILE_SIZE) {
      toast.error(
        `File size exceeds 5 MB limit (${(fileObj.size / (1024 * 1024)).toFixed(2)} MB). Maximum file size: 5 MB.`
      );
      return;
    }

    // Validation: Allowed MIME types & extensions
    const lowerName = fileObj.name.toLowerCase();
    const hasValidExtension =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp');
    const hasValidMime = ALLOWED_MIME_TYPES.includes(fileObj.type);

    if (!hasValidExtension && !hasValidMime) {
      toast.error(
        `Unsupported file type: ${fileObj.type || 'unknown'}. Please upload PDF, PNG, JPEG, or WEBP.`
      );
      return;
    }

    try {
      setUploadingDoc(docType);

      // Read actual file bytes into base64 data URI
      const dataUri = await readFileAsDataUrl(fileObj);

      let mimeType = fileObj.type;
      if (!mimeType) {
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }

      await verificationApi.uploadDocument(createdCase.id || createdCase._id, {
        type: docType,
        filename: fileObj.name,
        mimeType,
        file: dataUri
      });

      // Refresh case to see new status (e.g. READY_FOR_PROCESSING)
      const refreshedCase = await verificationApi.getCase(createdCase.id || createdCase._id);
      setCreatedCase(refreshedCase);

      setUploadedDocs(prev => ({ ...prev, [docType]: true }));
      toast.success(`${docType.replace(/_/g, ' ')} uploaded successfully!`);
    } catch (err: any) {
      console.error(`Upload error for ${docType}:`, err);
      const msg = err.response?.data?.message || err.message || `Failed to upload ${docType}`;
      toast.error(msg);
    } finally {
      setUploadingDoc(null);
    }
  };

  // Step 5: Process Case
  const handleTriggerProcessing = async () => {
    if (!createdCase) return;
    try {
      setIsProcessing(true);
      await verificationApi.processCase(createdCase.id || createdCase._id);
      toast.success('TrustRAG verification pipeline executed successfully!');
      navigate(`/cases/${createdCase.id || createdCase._id}`);
    } catch (err: any) {
      console.error('Processing trigger error:', err);
      const msg = err.response?.data?.message || err.message || 'Error processing case';
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const isReadyForProcessing =
    uploadedDocs.PRESCRIPTION &&
    uploadedDocs.PHARMACY_INVOICE &&
    uploadedDocs.CLAIM_FORM;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <VerificationNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                <FilePlus className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                New Verification Case Wizard
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Initialize a case, securely upload Tri-Document evidence (Rx, Invoice, Claim), and run TrustRAG cross-verification.
            </p>
          </div>
        </div>

        {/* Stepper Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
          <LifecycleStepper
            currentStatus={createdCase ? createdCase.status : 'DRAFT'}
            isReviewRequired={createdCase ? createdCase.reviewRequired : false}
          />
        </div>

        {/* Wizard Form Section */}
        {!createdCase ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-2xs max-w-xl mx-auto">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Step 1: Initialize Verification Case
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Create the verification envelope. Once created, you will upload the required three healthcare documents.
            </p>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subject / Patient Reference (Optional)
                </label>
                <input
                  type="text"
                  value={subjectRef}
                  onChange={e => setSubjectRef(e.target.value)}
                  placeholder="e.g. PATIENT-789012 or Leave empty for auto-generation"
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Synthetic or de-identified subject ID for audit trail tracking.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Intake Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={caseNotes}
                  onChange={e => setCaseNotes(e.target.value)}
                  placeholder="e.g. Routine monthly chronic medication dispensation verification."
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreatingCase}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:bg-slate-300"
                >
                  {isCreatingCase ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Initializing Case...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Verification Case</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Case Info Banner */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Case Reference
                </div>
                <div className="text-base font-mono font-bold text-slate-900 mt-0.5">
                  {createdCase.caseReference}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Subject Reference
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">
                  {createdCase.subjectReference}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Case Status
                </div>
                <span className="inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                  {createdCase.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Tri-Document Upload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Document 1: PRESCRIPTION */}
              <DocumentUploadCard
                docType="PRESCRIPTION"
                title="Prescription (Rx)"
                subtitle="Issued by licensed physician"
                isUploaded={uploadedDocs.PRESCRIPTION}
                isUploading={uploadingDoc === 'PRESCRIPTION'}
                onUploadFile={file => handleFileUpload('PRESCRIPTION', file)}
                onQuickUpload={
                  import.meta.env.DEV
                    ? () => handleFileUpload('PRESCRIPTION', createDevPdfFixture('prescription_sample.pdf'))
                    : undefined
                }
              />

              {/* Document 2: PHARMACY_INVOICE */}
              <DocumentUploadCard
                docType="PHARMACY_INVOICE"
                title="Pharmacy Invoice"
                subtitle="Dispensation bill with batch & price"
                isUploaded={uploadedDocs.PHARMACY_INVOICE}
                isUploading={uploadingDoc === 'PHARMACY_INVOICE'}
                onUploadFile={file => handleFileUpload('PHARMACY_INVOICE', file)}
                onQuickUpload={
                  import.meta.env.DEV
                    ? () => handleFileUpload('PHARMACY_INVOICE', createDevPdfFixture('invoice_sample.pdf'))
                    : undefined
                }
              />

              {/* Document 3: CLAIM_FORM */}
              <DocumentUploadCard
                docType="CLAIM_FORM"
                title="Health Claim Form"
                subtitle="Policyholder claim submission"
                isUploaded={uploadedDocs.CLAIM_FORM}
                isUploading={uploadingDoc === 'CLAIM_FORM'}
                onUploadFile={file => handleFileUpload('CLAIM_FORM', file)}
                onQuickUpload={
                  import.meta.env.DEV
                    ? () => handleFileUpload('CLAIM_FORM', createDevPdfFixture('claim_sample.pdf'))
                    : undefined
                }
              />
            </div>

            {/* Action Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  TrustRAG Processing Gate
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isReadyForProcessing
                    ? 'All 3 documents ingested. Case is READY_FOR_PROCESSING.'
                    : 'Upload all 3 required documents above to enable TrustRAG verification.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/cases/${createdCase.id || createdCase._id}`)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  View Case Details
                </button>

                <button
                  onClick={handleTriggerProcessing}
                  disabled={!isReadyForProcessing || isProcessing}
                  className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing Engine Running...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      <span>Process Case with TrustRAG</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

interface DocumentUploadCardProps {
  docType: DocumentType;
  title: string;
  subtitle: string;
  isUploaded: boolean;
  isUploading: boolean;
  onUploadFile: (file: File) => void;
  onQuickUpload?: () => void;
}

const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  docType,
  title,
  subtitle,
  isUploaded,
  isUploading,
  onUploadFile,
  onQuickUpload
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className={`rounded-xl border p-5 flex flex-col justify-between transition-all bg-white ${
      isUploaded
        ? 'border-emerald-300 ring-2 ring-emerald-500/10 shadow-2xs'
        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${
            isUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            <FileText className="w-5 h-5" />
          </div>

          {isUploaded && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Uploaded
            </span>
          )}
        </div>

        <h4 className="font-bold text-sm text-slate-900">{title}</h4>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
        <p className="text-[10px] text-slate-500 mt-1 font-medium">
          PDF, PNG, JPEG, WEBP. Maximum file size: 5 MB.
        </p>
        <span className="inline-block mt-2 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          type: {docType}
        </span>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 px-3 border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5" />
          )}
          <span>{isUploaded ? 'Replace Document' : 'Upload File (PDF/Image)'}</span>
        </button>

        {/* Local development fixture only — must never be used with real healthcare documents. */}
        {import.meta.env.DEV && onQuickUpload && (
          <button
            type="button"
            disabled={isUploading}
            onClick={onQuickUpload}
            className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
            title="Use synthetic standardized document fixture (Development Only)"
          >
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Quick Synthetic Fill</span>
          </button>
        )}
      </div>
    </div>
  );
};
