class EscalationEngine {
  escalate(workflow, context, reason) {
    let target = workflow.escalationRules?.escalateTo || 'admin';
    
    // Dynamic routing overrides
    if (context.riskClass === 'Emergency Risk' || reason.includes('contradiction') || reason.includes('severe')) {
      target = 'pharmacist'; // Critical medical issues go to pharmacist
    }
    
    if (reason.includes('missed') || reason.includes('refill')) {
      target = 'patient'; // Adherence goes to patient first, unless overridden
    }

    const escalationEvent = {
      reason,
      targetRole: target,
      timestamp: new Date()
    };

    console.log(`[ESCALATION ENGINE] Escalated workflow ${workflow.id} to ${target}. Reason: ${reason}`);
    
    return escalationEvent;
  }
}

module.exports = new EscalationEngine();
