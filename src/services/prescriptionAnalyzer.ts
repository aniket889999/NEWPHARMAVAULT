import { Prescription, Medicine, DrugInteraction, InteractionCheck } from '../types';
import { enhancedMedicines, checkDrugInteractions } from '../data/enhancedMedicines';

export class PrescriptionAnalyzer {
  private static instance: PrescriptionAnalyzer;
  
  public static getInstance(): PrescriptionAnalyzer {
    if (!PrescriptionAnalyzer.instance) {
      PrescriptionAnalyzer.instance = new PrescriptionAnalyzer();
    }
    return PrescriptionAnalyzer.instance;
  }

  async analyzePrescription(prescription: Prescription): Promise<{
    interactions: InteractionCheck;
    dosageWarnings: string[];
    contraindications: string[];
    recommendations: string[];
    totalCost: number;
    availability: { available: number; unavailable: number };
  }> {
    const medicineIds = prescription.medicines.map(pm => pm.medicineId);
    const medicines = medicineIds
      .map(id => enhancedMedicines.find(med => med.id === id))
      .filter(Boolean) as Medicine[];

    // Check drug interactions
    const interactions = await this.checkInteractions(medicineIds);
    
    // Check dosage warnings
    const dosageWarnings = this.checkDosageWarnings(prescription, medicines);
    
    // Check contraindications
    const contraindications = this.checkContraindications(medicines);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(prescription, medicines, interactions);
    
    // Calculate total cost
    const totalCost = this.calculateTotalCost(prescription, medicines);
    
    // Check availability
    const availability = this.checkAvailability(medicines);

    return {
      interactions,
      dosageWarnings,
      contraindications,
      recommendations,
      totalCost,
      availability
    };
  }

  private async checkInteractions(medicineIds: string[]): Promise<InteractionCheck> {
    const interactions = checkDrugInteractions(medicineIds);
    
    let severity: InteractionCheck['severity'] = 'none';
    if (interactions.length > 0) {
      const severities = interactions.map(i => i.severity);
      if (severities.includes('severe')) severity = 'severe';
      else if (severities.includes('moderate')) severity = 'moderate';
      else severity = 'mild';
    }

    const recommendations: string[] = [];
    const alternatives: string[] = [];

    interactions.forEach(interaction => {
      recommendations.push(interaction.recommendation);
      
      if (interaction.severity === 'severe') {
        alternatives.push(`Consider alternative to ${interaction.drugName}`);
      }
    });

    return {
      medicines: medicineIds,
      interactions,
      severity,
      recommendations: [...new Set(recommendations)],
      alternatives: alternatives.length > 0 ? [...new Set(alternatives)] : undefined
    };
  }

  private checkDosageWarnings(prescription: Prescription, medicines: Medicine[]): string[] {
    const warnings: string[] = [];
    
    prescription.medicines.forEach(prescribedMed => {
      const medicine = medicines.find(med => med.id === prescribedMed.medicineId);
      if (!medicine) return;

      // Check for high dosage patterns
      const dosageNum = this.extractDosageNumber(prescribedMed.dosage);
      const medicineStrengthNum = this.extractDosageNumber(medicine.strength);
      
      if (dosageNum && medicineStrengthNum && dosageNum > medicineStrengthNum * 2) {
        warnings.push(`High dosage prescribed for ${medicine.name}: ${prescribedMed.dosage}`);
      }

      // Check frequency warnings
      if (prescribedMed.frequency.includes('4 times') || prescribedMed.frequency.includes('every 4 hours')) {
        warnings.push(`Frequent dosing for ${medicine.name} - monitor for side effects`);
      }

      // Check duration warnings
      if (prescribedMed.duration.includes('month') && medicine.category.includes('Antibiotic')) {
        warnings.push(`Long-term antibiotic use (${medicine.name}) - monitor for resistance`);
      }
    });

    return warnings;
  }

  private checkContraindications(medicines: Medicine[]): string[] {
    const contraindications: string[] = [];
    
    medicines.forEach(medicine => {
      medicine.contraindications.forEach(contraindication => {
        contraindications.push(`${medicine.name}: ${contraindication}`);
      });
    });

    return contraindications;
  }

  private generateRecommendations(
    prescription: Prescription, 
    medicines: Medicine[], 
    interactions: InteractionCheck
  ): string[] {
    const recommendations: string[] = [];

    // Interaction-based recommendations
    if (interactions.severity === 'severe') {
      recommendations.push('⚠️ Severe drug interactions detected - consult prescribing physician immediately');
    } else if (interactions.severity === 'moderate') {
      recommendations.push('⚠️ Moderate drug interactions present - monitor closely for side effects');
    }

    // Pregnancy category warnings
    const pregnancyCategories = medicines
      .filter(med => med.pregnancyCategory && ['D', 'X'].includes(med.pregnancyCategory))
      .map(med => med.name);
    
    if (pregnancyCategories.length > 0) {
      recommendations.push(`⚠️ Pregnancy warning: ${pregnancyCategories.join(', ')} - not recommended during pregnancy`);
    }

    // Prescription requirements
    const otcMedicines = medicines.filter(med => !med.prescriptionRequired);
    if (otcMedicines.length > 0) {
      recommendations.push(`ℹ️ Available OTC: ${otcMedicines.map(med => med.name).join(', ')}`);
    }

    // Generic alternatives
    const brandMedicines = medicines.filter(med => med.name !== med.genericName);
    if (brandMedicines.length > 0) {
      recommendations.push(`💰 Consider generic alternatives to reduce costs`);
    }

    // Timing recommendations
    const hasAntibiotics = medicines.some(med => med.category.includes('Antibiotic'));
    if (hasAntibiotics) {
      recommendations.push(`⏰ Take antibiotics at evenly spaced intervals and complete full course`);
    }

    const hasStatins = medicines.some(med => med.category.includes('Statin'));
    if (hasStatins) {
      recommendations.push(`🌙 Take statins in the evening for better effectiveness`);
    }

    return recommendations;
  }

  private calculateTotalCost(prescription: Prescription, medicines: Medicine[]): number {
    let totalCost = 0;
    
    prescription.medicines.forEach(prescribedMed => {
      const medicine = medicines.find(med => med.id === prescribedMed.medicineId);
      if (medicine) {
        // Calculate cost based on quantity
        const unitCost = medicine.price;
        const quantity = prescribedMed.quantity;
        totalCost += unitCost * (quantity / 10); // Assuming price is per 10 units
      }
    });

    return Math.round(totalCost * 100) / 100;
  }

  private checkAvailability(medicines: Medicine[]): { available: number; unavailable: number } {
    const available = medicines.filter(med => med.inStock).length;
    const unavailable = medicines.length - available;
    
    return { available, unavailable };
  }

  private extractDosageNumber(dosageString: string): number | null {
    const match = dosageString.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  generatePrescriptionReport(
    prescription: Prescription,
    analysis: Awaited<ReturnType<PrescriptionAnalyzer['analyzePrescription']>>
  ): string {
    let report = `**Prescription Analysis Report**\n\n`;
    
    report += `**Patient:** ${prescription.patientId}\n`;
    report += `**Prescribed by:** ${prescription.doctorId}\n`;
    report += `**Issue Date:** ${prescription.issueDate.toLocaleDateString()}\n`;
    report += `**Valid Until:** ${prescription.validUntil.toLocaleDateString()}\n\n`;

    if (prescription.diagnosis) {
      report += `**Diagnosis:** ${prescription.diagnosis}\n\n`;
    }

    // Medicines list
    report += `**Prescribed Medicines:**\n`;
    prescription.medicines.forEach((med, index) => {
      report += `${index + 1}. **${med.medicineName}**\n`;
      report += `   - Dosage: ${med.dosage}\n`;
      report += `   - Frequency: ${med.frequency}\n`;
      report += `   - Duration: ${med.duration}\n`;
      report += `   - Quantity: ${med.quantity}\n`;
      if (med.instructions) {
        report += `   - Instructions: ${med.instructions}\n`;
      }
      report += `\n`;
    });

    // Cost analysis
    report += `**Cost Analysis:**\n`;
    report += `Total Estimated Cost: ₹${analysis.totalCost.toFixed(2)}\n\n`;

    // Availability
    report += `**Availability:**\n`;
    report += `Available: ${analysis.availability.available}/${prescription.medicines.length} medicines\n`;
    if (analysis.availability.unavailable > 0) {
      report += `⚠️ ${analysis.availability.unavailable} medicine(s) currently out of stock\n`;
    }
    report += `\n`;

    // Drug interactions
    if (analysis.interactions.interactions.length > 0) {
      report += `**Drug Interactions (${analysis.interactions.severity.toUpperCase()}):**\n`;
      analysis.interactions.interactions.forEach(interaction => {
        const severityEmoji = {
          'mild': '⚠️',
          'moderate': '⚠️',
          'severe': '🚨'
        }[interaction.severity];
        
        report += `${severityEmoji} ${interaction.drugName}: ${interaction.description}\n`;
        report += `   Recommendation: ${interaction.recommendation}\n\n`;
      });
    }

    // Dosage warnings
    if (analysis.dosageWarnings.length > 0) {
      report += `**Dosage Warnings:**\n`;
      analysis.dosageWarnings.forEach(warning => {
        report += `⚠️ ${warning}\n`;
      });
      report += `\n`;
    }

    // Contraindications
    if (analysis.contraindications.length > 0) {
      report += `**Contraindications:**\n`;
      analysis.contraindications.forEach(contraindication => {
        report += `⚠️ ${contraindication}\n`;
      });
      report += `\n`;
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      report += `**Recommendations:**\n`;
      analysis.recommendations.forEach(recommendation => {
        report += `${recommendation}\n`;
      });
      report += `\n`;
    }

    report += `**Important:** This analysis is for informational purposes only. Always follow your healthcare provider's instructions and consult them for any concerns.`;
    
    return report;
  }

  async extractPrescriptionFromText(text: string): Promise<Partial<Prescription>> {
    // Simple NLP to extract prescription information from text
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const medicines: PrescribedMedicine[] = [];
    let diagnosis = '';
    let instructions = '';

    for (const line of lines) {
      // Look for medicine patterns
      const medicinePattern = /^(\d+\.?\s*)?([A-Za-z\s]+)\s*[-:]?\s*(\d+\s*mg|mg\s*\d+)/i;
      const match = line.match(medicinePattern);
      
      if (match) {
        const medicineName = match[2].trim();
        const dosage = match[3];
        
        // Look for frequency in the same line or next lines
        const frequencyPattern = /(once|twice|thrice|\d+\s*times?).*?(daily|day|morning|evening|night)/i;
        const freqMatch = line.match(frequencyPattern);
        
        medicines.push({
          medicineId: `med-${Date.now()}-${medicines.length}`,
          medicineName,
          dosage,
          frequency: freqMatch ? freqMatch[0] : 'As directed',
          duration: '7 days', // Default
          quantity: 10, // Default
          instructions: 'Take as prescribed'
        });
      }
      
      // Look for diagnosis
      if (line.toLowerCase().includes('diagnosis') || line.toLowerCase().includes('condition')) {
        diagnosis = line.replace(/diagnosis:?/i, '').trim();
      }
      
      // Look for general instructions
      if (line.toLowerCase().includes('instruction') || line.toLowerCase().includes('note')) {
        instructions = line.replace(/instruction:?|note:?/i, '').trim();
      }
    }

    return {
      medicines,
      diagnosis: diagnosis || undefined,
      instructions: instructions || 'Follow prescription as directed',
      issueDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'active'
    };
  }
}