const workflowRegistry = require('./workflowRegistry');
const taskPrioritizer = require('./taskPrioritizer');
const workflowAuditLogger = require('./workflowAuditLogger');
const workflowExecutor = require('./workflowExecutor');
const WorkflowAudit = require('../models/workflowAuditModel');

class WorkflowEngine {
  async triggerEvent(event, context) {
    // Deduplication Logic
    const existingActive = await WorkflowAudit.findOne({
      workflowId: { $in: workflowRegistry.getWorkflowsByTrigger(event).map(w => w.id) },
      status: 'active',
      'metadata.query': context.query, // Match by query to prevent spamming same issue
      pharmacyId: context.pharmacyId
    });

    if (existingActive) {
      return { success: false, message: "Duplicate active workflow detected. Skipping." };
    }

    const matchingWorkflows = workflowRegistry.getWorkflowsByTrigger(event);
    
    if (matchingWorkflows.length === 0) {
      return;
    }

    for (const workflow of matchingWorkflows) {
      const priority = taskPrioritizer.calculatePriority(event, context);
      const auditId = await workflowAuditLogger.logTrigger(workflow, event, priority, context);
      
      context.approvalStatus = workflow.requireApproval ? 'pending' : 'not_required';
      await workflowExecutor.execute(workflow, auditId, context);
    }
  }

  async seedDemoWorkflows(pharmacyId, userId) {
    const demoEvents = [
      { event: 'hallucination_risk_high', ctx: { query: 'Is Dolo safe for infants?', riskClass: 'High Risk', hallucinationRisk: 'High' } },
      { event: 'refill_risk_high', ctx: { query: 'Patient John Doe refill check', medicineName: 'Metformin', daysRemaining: 2 } },
      { event: 'ocr_confidence_low', ctx: { query: 'Handwritten prescription upload', ocrConfidence: 0.45 } },
      { event: 'emergency_flag', ctx: { query: 'Chest pain reported', riskClass: 'Emergency Risk' } }
    ];

    for (const demo of demoEvents) {
      await this.triggerEvent(demo.event, { 
        ...demo.ctx, 
        pharmacyId, 
        userId,
        isDemo: true 
      });
    }
    return { success: true, message: "Demo workflows seeded successfully." };
  }

  async getActiveWorkflows(pharmacyId) {
    const query = { status: { $in: ['active', 'failed'] } };
    if (pharmacyId) query.pharmacyId = pharmacyId;
    return await WorkflowAudit.find(query).sort({ createdAt: -1 });
  }

  async getPendingApprovals(pharmacyId) {
    const query = { approvalStatus: 'pending', status: 'active' };
    if (pharmacyId) query.pharmacyId = pharmacyId;
    return await WorkflowAudit.find(query).sort({ createdAt: -1 });
  }

  async approveWorkflow(auditId, userId, approverRole) {
    const audit = await WorkflowAudit.findById(auditId);
    if (!audit || audit.approvalStatus !== 'pending') {
      throw new Error("Workflow not found or not pending approval");
    }

    if (audit.approverRole !== approverRole && approverRole !== 'admin') {
      throw new Error(`Unauthorized. Approval requires role: ${audit.approverRole}`);
    }

    await workflowAuditLogger.logApproval(auditId, userId, 'approved');
    
    // Resume execution
    const workflow = workflowRegistry.getWorkflowById(audit.workflowId);
    if (workflow) {
      const context = audit.metadata || {};
      context.approvalStatus = 'approved';
      await workflowExecutor.execute(workflow, auditId, context);
    }
    
    return { success: true, message: 'Workflow approved and execution resumed' };
  }

  async rejectWorkflow(auditId, userId, approverRole) {
    const audit = await WorkflowAudit.findById(auditId);
    if (!audit || audit.approvalStatus !== 'pending') {
      throw new Error("Workflow not found or not pending approval");
    }

    await workflowAuditLogger.logApproval(auditId, userId, 'rejected');
    return { success: true, message: 'Workflow rejected' };
  }
}

module.exports = new WorkflowEngine();
