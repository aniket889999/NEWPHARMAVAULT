// Predefined workflows registry
class WorkflowRegistry {
  constructor() {
    this.workflows = [
      {
        id: 'wf_refill_reminder',
        name: 'Refill Reminder Workflow',
        triggerEvents: ['refill_risk_high'],
        requireApproval: false,
        actions: ['generate_reminder', 'notify_patient'],
        escalationRules: { maxFailedAttempts: 3, escalateTo: 'pharmacist' }
      },
      {
        id: 'wf_expiry_escalation',
        name: 'Expiry Escalation Workflow',
        triggerEvents: ['expiry_approaching'],
        requireApproval: false,
        actions: ['flag_inventory', 'notify_pharmacist'],
        escalationRules: { escalateTo: 'admin' }
      },
      {
        id: 'wf_rx_clarification',
        name: 'Prescription Clarification Workflow',
        triggerEvents: ['ocr_confidence_low', 'prescription_ambiguity'],
        requireApproval: true,
        approverRole: 'pharmacist',
        actions: ['queue_for_review', 'notify_pharmacist'],
        escalationRules: { escalateTo: 'doctor' }
      },
      {
        id: 'wf_low_stock_escalation',
        name: 'Low Stock Escalation Workflow',
        triggerEvents: ['medicine_low_stock'],
        requireApproval: true,
        approverRole: 'pharmacist',
        actions: ['generate_reorder_suggestion', 'queue_for_review'],
        escalationRules: { escalateTo: 'admin' }
      },
      {
        id: 'wf_missed_medication',
        name: 'Missed Medication Escalation Workflow',
        triggerEvents: ['reminder_missed_repeatedly'],
        requireApproval: false,
        actions: ['log_adherence_drop', 'notify_patient'],
        escalationRules: { escalateTo: 'pharmacist' }
      },
      {
        id: 'wf_emergency_safety',
        name: 'Emergency Safety Workflow',
        triggerEvents: ['emergency_flag', 'severe_interaction', 'contradiction_detected'],
        requireApproval: true,
        approverRole: 'pharmacist',
        actions: ['block_transaction', 'alert_pharmacist_critical', 'notify_patient_warning'],
        escalationRules: { escalateTo: 'admin' }
      },
      {
        id: 'wf_human_review',
        name: 'Human Review Escalation Workflow',
        triggerEvents: ['hallucination_risk_high', 'unsupported_claims'],
        requireApproval: true,
        approverRole: 'pharmacist',
        actions: ['queue_for_review', 'suppress_ai_output'],
        escalationRules: { escalateTo: 'admin' }
      }
    ];
  }

  getWorkflowById(id) {
    return this.workflows.find(w => w.id === id);
  }

  getWorkflowsByTrigger(trigger) {
    return this.workflows.filter(w => w.triggerEvents.includes(trigger));
  }
  
  getAllWorkflows() {
    return this.workflows;
  }
}

module.exports = new WorkflowRegistry();
