import { QuestionTemplate, Medicine } from '../types';
import { format } from 'date-fns';

export const questionTemplates: QuestionTemplate[] = [
  {
    id: 'alternatives',
    text: 'Show me alternatives for this medicine',
    responseTemplate: (medicine: Medicine) => {
      if (!medicine.alternatives || medicine.alternatives.length === 0) {
        return `I don't have information about alternatives for ${medicine.name}. Please consult your healthcare provider for suitable alternatives.`;
      }
      
      return `
Here are alternatives for ${medicine.name}:
${medicine.alternatives.map(alt => `• ${alt}`).join('\n')}

Please consult your healthcare provider before switching medications.
      `.trim();
    }
  },
  {
    id: 'dosage',
    text: 'What is the dosage of this medicine?',
    responseTemplate: (medicine: Medicine) => {
      return `
**Dosage information for ${medicine.name}:**

${medicine.dosage}

Please note that this is general guidance. Follow your doctor's specific instructions, as dosage may vary based on your condition, age, weight, and other factors.
      `.trim();
    }
  },
  {
    id: 'usage',
    text: 'What is this medicine used for?',
    responseTemplate: (medicine: Medicine) => {
      if (!medicine.usedFor || medicine.usedFor.length === 0) {
        return `I don't have detailed information about what ${medicine.name} is used for. Please consult the package insert or your healthcare provider.`;
      }
      
      return `
${medicine.name} is commonly used for:
${medicine.usedFor.map(use => `• ${use}`).join('\n')}

${medicine.description}

Always use as directed by your healthcare provider.
      `.trim();
    }
  },
  {
    id: 'sideEffects',
    text: 'What are the side effects of this medicine?',
    responseTemplate: (medicine: Medicine) => {
      if (!medicine.sideEffects || medicine.sideEffects.length === 0) {
        return `I don't have detailed information about side effects for ${medicine.name}. Please refer to the package insert or consult your healthcare provider.`;
      }
      
      return `
**Potential side effects of ${medicine.name}:**

${medicine.sideEffects.map(effect => `• ${effect}`).join('\n')}

This is not a complete list. Contact your doctor if you experience any unexpected symptoms.
      `.trim();
    }
  },
  {
    id: 'expiryDate',
    text: 'What is the expiry date of this medicine?',
    responseTemplate: (medicine: Medicine) => {
      try {
        const expiryDate = new Date(medicine.expiryDate);
        const formattedDate = format(expiryDate, 'MMMM d, yyyy');
        const today = new Date();
        
        const isExpired = expiryDate < today;
        const warningMessage = isExpired 
          ? '⚠️ **This medicine has expired and should not be used.**' 
          : '';
        
        return `
The expiry date for ${medicine.name} is ${formattedDate}.

${warningMessage}

Using expired medication can be ineffective or potentially harmful. Always check expiration dates before taking any medicine.
        `.trim();
      } catch (error) {
        return `The expiry information for ${medicine.name} is not available or invalid. Please check the physical packaging.`;
      }
    }
  }
];