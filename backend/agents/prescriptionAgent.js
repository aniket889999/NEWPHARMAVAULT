const Prescription = require('../models/prescriptionModel');

class PrescriptionAgent {
  async process(context, userId) {
    if (!context.intent.includes('prescription_question')) {
      context.agentTrace.push("Prescription Agent: Skipped (not a prescription query).");
      return context;
    }

    if (!userId) {
      context.agentTrace.push("Prescription Agent: Blocked (No user ID provided).");
      context.safetyWarnings.push("I need you to log in to access your prescriptions securely.");
      return context;
    }

    const prescriptions = await Prescription.find({ user: userId }).sort('-createdAt').limit(3);

    if (prescriptions.length > 0) {
      const recentRx = prescriptions[0];
      const meds = recentRx.detectedMedicines.map(m => `${m.medicineName || m.name} (${m.dosage || 'Unknown dosage'})`).join(', ');
      
      context.prescriptionEvidence = {
        date: recentRx.createdAt,
        medicines: meds,
        doctor: recentRx.doctorName || 'Unknown Doctor'
      };
      context.agentTrace.push(`Prescription Agent: Retrieved recent prescription containing: ${meds}.`);
    } else {
      context.agentTrace.push("Prescription Agent: No recent prescriptions found for user.");
    }

    return context;
  }
}

module.exports = new PrescriptionAgent();
