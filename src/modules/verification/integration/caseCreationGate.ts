import type { DocumentType, VerificationCaseStatus } from '../types';

export function caseCreationGate(uploaded: Record<DocumentType, boolean>, status: VerificationCaseStatus | undefined, busy: boolean) {
  const hasRequiredSources = uploaded.PRESCRIPTION && uploaded.PHARMACY_INVOICE;
  const canProcess = hasRequiredSources && status === 'READY_FOR_PROCESSING' && !busy;
  const message = !hasRequiredSources
    ? 'Upload a prescription and pharmacy invoice. A claim form is optional supporting evidence.'
    : status !== 'READY_FOR_PROCESSING'
      ? 'Required medicine sources are uploaded. The server has not marked this case ready; inspect the case details before processing.'
      : busy
        ? 'A source upload or processing operation is in progress. Please wait.'
        : 'Prescription and invoice are ready for extraction and checks. Human validation is still required.';
  return { hasRequiredSources, canProcess, message };
}
