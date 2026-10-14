import { Medicine, ComparisonResult, ComparisonCriteria, ComparisonMetric } from '../types';
import { enhancedMedicines } from '../data/enhancedMedicines';

export class ComparisonService {
  private static instance: ComparisonService;
  
  public static getInstance(): ComparisonService {
    if (!ComparisonService.instance) {
      ComparisonService.instance = new ComparisonService();
    }
    return ComparisonService.instance;
  }

  async compareMedicines(
    medicineIds: string[],
    criteria: ComparisonCriteria
  ): Promise<ComparisonResult> {
    const medicines = medicineIds
      .map(id => enhancedMedicines.find(med => med.id === id))
      .filter(Boolean) as Medicine[];

    if (medicines.length < 2) {
      throw new Error('At least 2 medicines are required for comparison');
    }

    const results: ComparisonMetric[] = medicines.map(medicine => 
      this.calculateMedicineScore(medicine, medicines, criteria)
    );

    return {
      medicines,
      criteria,
      results
    };
  }

  private calculateMedicineScore(
    medicine: Medicine,
    allMedicines: Medicine[],
    criteria: ComparisonCriteria
  ): ComparisonMetric {
    const scores = {
      price: 0,
      effectiveness: 0,
      sideEffects: 0,
      availability: 0,
      overall: 0
    };

    const pros: string[] = [];
    const cons: string[] = [];

    // Price scoring (lower price = higher score)
    if (criteria.price) {
      const prices = allMedicines.map(med => med.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      if (maxPrice > minPrice) {
        scores.price = ((maxPrice - medicine.price) / (maxPrice - minPrice)) * 100;
      } else {
        scores.price = 100;
      }

      if (medicine.price === minPrice) {
        pros.push('Most affordable option');
      } else if (medicine.price === maxPrice) {
        cons.push('Most expensive option');
      }
    }

    // Effectiveness scoring (based on therapeutic class and indications)
    if (criteria.effectiveness) {
      scores.effectiveness = this.calculateEffectivenessScore(medicine);
      
      if (scores.effectiveness >= 80) {
        pros.push('Highly effective for multiple conditions');
      } else if (scores.effectiveness < 60) {
        cons.push('Limited effectiveness scope');
      }
    }

    // Side effects scoring (fewer side effects = higher score)
    if (criteria.sideEffects) {
      const sideEffectCounts = allMedicines.map(med => med.sideEffects.length);
      const minSideEffects = Math.min(...sideEffectCounts);
      const maxSideEffects = Math.max(...sideEffectCounts);
      
      if (maxSideEffects > minSideEffects) {
        scores.sideEffects = ((maxSideEffects - medicine.sideEffects.length) / (maxSideEffects - minSideEffects)) * 100;
      } else {
        scores.sideEffects = 100;
      }

      if (medicine.sideEffects.length === minSideEffects) {
        pros.push('Fewer reported side effects');
      } else if (medicine.sideEffects.length === maxSideEffects) {
        cons.push('More potential side effects');
      }
    }

    // Availability scoring
    if (criteria.availability) {
      const totalInventory = medicine.pharmacyInventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
      const pharmacyCount = medicine.pharmacyInventory?.length || 0;
      
      scores.availability = Math.min(100, (totalInventory / 10) + (pharmacyCount * 20));
      
      if (medicine.inStock && pharmacyCount > 1) {
        pros.push('Widely available');
      } else if (!medicine.inStock) {
        cons.push('Currently out of stock');
      }
    }

    // Calculate overall score
    const enabledCriteria = Object.values(criteria).filter(Boolean).length;
    if (enabledCriteria > 0) {
      scores.overall = (
        (criteria.price ? scores.price : 0) +
        (criteria.effectiveness ? scores.effectiveness : 0) +
        (criteria.sideEffects ? scores.sideEffects : 0) +
        (criteria.availability ? scores.availability : 0)
      ) / enabledCriteria;
    }

    // Generate recommendation
    let recommendation = '';
    if (scores.overall >= 80) {
      recommendation = 'Highly recommended based on selected criteria';
    } else if (scores.overall >= 60) {
      recommendation = 'Good option with some trade-offs';
    } else {
      recommendation = 'Consider alternatives or consult healthcare provider';
    }

    // Add specific recommendations
    if (!medicine.prescriptionRequired) {
      pros.push('Available over-the-counter');
    } else {
      cons.push('Requires prescription');
    }

    if (medicine.pregnancyCategory && ['A', 'B'].includes(medicine.pregnancyCategory)) {
      pros.push('Generally safe during pregnancy');
    } else if (medicine.pregnancyCategory === 'X') {
      cons.push('Not safe during pregnancy');
    }

    return {
      medicineId: medicine.id,
      scores,
      pros,
      cons,
      recommendation
    };
  }

  private calculateEffectivenessScore(medicine: Medicine): number {
    // Base score on number of indications and therapeutic importance
    let score = Math.min(medicine.usedFor.length * 10, 60);
    
    // Bonus for important therapeutic classes
    const importantClasses = [
      'antibiotic',
      'ace inhibitor',
      'statin',
      'antidiabetic',
      'analgesic'
    ];
    
    if (importantClasses.some(cls => 
      medicine.therapeuticClass.toLowerCase().includes(cls)
    )) {
      score += 20;
    }

    // Bonus for multiple active ingredients
    if (medicine.activeIngredients.length > 1) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  generateComparisonReport(result: ComparisonResult): string {
    let report = `**Medicine Comparison Report**\n\n`;
    
    // Summary table
    report += `**Comparison Summary:**\n`;
    report += `| Medicine | Overall Score | Price | Availability |\n`;
    report += `|----------|---------------|-------|-------------|\n`;
    
    result.results
      .sort((a, b) => b.scores.overall - a.scores.overall)
      .forEach(metric => {
        const medicine = result.medicines.find(med => med.id === metric.medicineId)!;
        report += `| ${medicine.name} | ${Math.round(metric.scores.overall)}% | ₹${medicine.price} | ${medicine.inStock ? '✅' : '❌'} |\n`;
      });

    report += `\n**Detailed Analysis:**\n\n`;

    result.results.forEach(metric => {
      const medicine = result.medicines.find(med => med.id === metric.medicineId)!;
      
      report += `**${medicine.name}** (${medicine.genericName})\n`;
      report += `Overall Score: ${Math.round(metric.scores.overall)}%\n\n`;
      
      if (metric.pros.length > 0) {
        report += `**Advantages:**\n`;
        metric.pros.forEach(pro => report += `• ${pro}\n`);
        report += `\n`;
      }
      
      if (metric.cons.length > 0) {
        report += `**Disadvantages:**\n`;
        metric.cons.forEach(con => report += `• ${con}\n`);
        report += `\n`;
      }
      
      report += `**Recommendation:** ${metric.recommendation}\n\n`;
      report += `---\n\n`;
    });

    report += `**Important:** This comparison is for informational purposes only. Always consult with a healthcare professional before making medication decisions.`;
    
    return report;
  }

  async findAlternatives(medicineId: string, maxResults: number = 5): Promise<Medicine[]> {
    const medicine = enhancedMedicines.find(med => med.id === medicineId);
    if (!medicine) return [];

    // Find medicines with same therapeutic class or category
    const alternatives = enhancedMedicines
      .filter(med => 
        med.id !== medicineId && 
        (med.therapeuticClass === medicine.therapeuticClass ||
         med.category === medicine.category ||
         med.usedFor.some(use => medicine.usedFor.includes(use)))
      )
      .sort((a, b) => {
        // Prioritize by therapeutic class match, then by price
        const aClassMatch = a.therapeuticClass === medicine.therapeuticClass ? 1 : 0;
        const bClassMatch = b.therapeuticClass === medicine.therapeuticClass ? 1 : 0;
        
        if (aClassMatch !== bClassMatch) {
          return bClassMatch - aClassMatch;
        }
        
        return a.price - b.price;
      })
      .slice(0, maxResults);

    return alternatives;
  }
}