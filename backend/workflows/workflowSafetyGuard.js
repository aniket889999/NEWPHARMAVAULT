class WorkflowSafetyGuard {
  validateAction(workflow, action, context) {
    // 1. DO NOT auto-prescribe medicine
    if (action === 'auto_prescribe') {
      return { safe: false, reason: 'Auto-prescription is strictly prohibited by safety policies.' };
    }
    
    // 2. DO NOT auto-approve prescriptions
    if (action === 'auto_approve_prescription') {
      return { safe: false, reason: 'Prescription approval requires human-in-the-loop (pharmacist).' };
    }

    // 3. DO NOT auto-diagnose
    if (action === 'auto_diagnose') {
      return { safe: false, reason: 'AI auto-diagnosis is prohibited.' };
    }
    
    // 4. DO NOT auto-modify medication schedules or dosages
    if (action === 'modify_schedule_automatically' || action === 'recommend_dosage_autonomously') {
      return { safe: false, reason: 'Medication schedules and dosages must be reviewed by healthcare professionals.' };
    }

    // 6. DO NOT auto-place orders
    if (action === 'place_order_automatically') {
      return { safe: false, reason: 'Order placement requires manual confirmation for safety and financial integrity.' };
    }

    // 7. DO NOT auto-substitute medicines without review
    if (action === 'substitute_medicine_autonomously') {
      return { safe: false, reason: 'Medicine substitution requires human pharmacist review for interaction safety.' };
    }
    
    // 5. Ensure approval controls are respected
    if (workflow.requireApproval && action === 'execute_final_transaction' && context.approvalStatus !== 'approved') {
       return { safe: false, reason: 'Human approval is required before this action.' };
    }

    return { safe: true };
  }
}

module.exports = new WorkflowSafetyGuard();
