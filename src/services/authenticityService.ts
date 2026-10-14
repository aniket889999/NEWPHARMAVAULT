import { AuthenticityCheck, Medicine } from '../types';

// Simulated CDSCO and FDA API integration
export class AuthenticityService {
  private static instance: AuthenticityService;
  
  public static getInstance(): AuthenticityService {
    if (!AuthenticityService.instance) {
      AuthenticityService.instance = new AuthenticityService();
    }
    return AuthenticityService.instance;
  }

  async verifyMedicine(
    medicineId: string,
    batchNumber: string,
    manufacturingDate: string,
    expiryDate: string
  ): Promise<AuthenticityCheck> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock verification logic
    const medicine = await this.getMedicineFromDatabase(medicineId);
    if (!medicine) {
      return {
        medicineId,
        batchNumber,
        manufacturingDate,
        expiryDate,
        status: 'suspicious',
        verificationSource: 'cdsco',
        confidence: 0.2,
        warnings: ['Medicine not found in regulatory database']
      };
    }

    // Check expiry date
    const expiry = new Date(expiryDate);
    const today = new Date();
    const isExpired = expiry < today;

    // Check batch number format
    const validBatchFormat = /^[A-Z]{3}\d{7}$/.test(batchNumber);
    
    // Check manufacturing date
    const mfgDate = new Date(manufacturingDate);
    const validMfgDate = mfgDate < today && mfgDate < expiry;

    let status: AuthenticityCheck['status'] = 'authentic';
    let confidence = 0.95;
    const warnings: string[] = [];

    if (isExpired) {
      status = 'expired';
      warnings.push('Medicine has expired');
      confidence -= 0.3;
    }

    if (!validBatchFormat) {
      status = 'suspicious';
      warnings.push('Invalid batch number format');
      confidence -= 0.4;
    }

    if (!validMfgDate) {
      status = 'suspicious';
      warnings.push('Invalid manufacturing date');
      confidence -= 0.3;
    }

    // Simulate random counterfeit detection
    if (Math.random() < 0.05) { // 5% chance of counterfeit
      status = 'counterfeit';
      confidence = 0.1;
      warnings.push('Suspected counterfeit medicine detected');
    }

    return {
      medicineId,
      batchNumber,
      manufacturingDate,
      expiryDate,
      status,
      verificationSource: medicine.cdscoDrugCode ? 'cdsco' : 'fda',
      confidence: Math.max(0.1, confidence),
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async verifyByCDSCO(drugCode: string): Promise<boolean> {
    // Simulate CDSCO API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock CDSCO verification
    const validCodes = ['CDSCO-PAR-001', 'CDSCO-AMX-002', 'CDSCO-LIS-003', 'CDSCO-MET-004', 'CDSCO-ATO-005'];
    return validCodes.includes(drugCode);
  }

  async verifyByFDA(approvalNumber: string): Promise<boolean> {
    // Simulate FDA API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Mock FDA verification
    const validNumbers = ['FDA-ANDA-123456', 'FDA-NDA-789012', 'FDA-NDA-345678', 'FDA-NDA-901234', 'FDA-NDA-567890'];
    return validNumbers.includes(approvalNumber);
  }

  async checkRecallStatus(medicineId: string): Promise<{
    isRecalled: boolean;
    recallDate?: Date;
    reason?: string;
    severity?: 'Class I' | 'Class II' | 'Class III';
  }> {
    // Simulate recall database check
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock recall data
    const recallDatabase = {
      'med-004': {
        isRecalled: true,
        recallDate: new Date('2024-01-10'),
        reason: 'Potential contamination in specific batch',
        severity: 'Class II' as const
      }
    };

    const recallInfo = recallDatabase[medicineId as keyof typeof recallDatabase];
    return recallInfo || { isRecalled: false };
  }

  private async getMedicineFromDatabase(medicineId: string): Promise<Medicine | null> {
    // This would typically fetch from your medicine database
    const { getMedicineById } = await import('../data/enhancedMedicines');
    return getMedicineById(medicineId) || null;
  }

  async generateAuthenticityReport(check: AuthenticityCheck): Promise<string> {
    const statusEmoji = {
      'authentic': '✅',
      'suspicious': '⚠️',
      'counterfeit': '🚨',
      'expired': '⏰'
    };

    const confidencePercentage = Math.round(check.confidence * 100);
    
    let report = `**Medicine Authenticity Report** ${statusEmoji[check.status]}\n\n`;
    report += `**Status:** ${check.status.toUpperCase()}\n`;
    report += `**Confidence Level:** ${confidencePercentage}%\n`;
    report += `**Verification Source:** ${check.verificationSource.toUpperCase()}\n`;
    report += `**Batch Number:** ${check.batchNumber}\n`;
    report += `**Manufacturing Date:** ${check.manufacturingDate}\n`;
    report += `**Expiry Date:** ${check.expiryDate}\n\n`;

    if (check.warnings && check.warnings.length > 0) {
      report += `**Warnings:**\n`;
      check.warnings.forEach(warning => {
        report += `• ${warning}\n`;
      });
      report += '\n';
    }

    switch (check.status) {
      case 'authentic':
        report += `**Recommendation:** This medicine appears to be authentic and safe to use (if not expired).\n`;
        break;
      case 'suspicious':
        report += `**Recommendation:** Exercise caution. Verify with your pharmacist or contact the manufacturer.\n`;
        break;
      case 'counterfeit':
        report += `**Recommendation:** DO NOT USE. This appears to be a counterfeit medicine. Report to authorities.\n`;
        break;
      case 'expired':
        report += `**Recommendation:** DO NOT USE. This medicine has expired and may be ineffective or harmful.\n`;
        break;
    }

    report += `\n**Important:** Always purchase medicines from licensed pharmacies and verify authenticity when in doubt.`;
    
    return report;
  }
}