const WorkflowAudit = require('../models/workflowAuditModel');

class WorkflowAuditLogger {
  async logTrigger(workflow, triggerEvent, priority, context) {
    try {
      const auditEntry = new WorkflowAudit({
        workflowId: workflow.id,
        workflowName: workflow.name,
        trigger: triggerEvent,
        approvalRequired: workflow.requireApproval,
        approverRole: workflow.approverRole,
        riskLevel: context.riskClass || 'Low',
        priority: priority,
        userId: context.userId,
        pharmacyId: context.pharmacyId,
        metadata: context
      });
      await auditEntry.save();
      return auditEntry._id;
    } catch (e) {
      console.error("[WORKFLOW AUDIT LOGGER] Failed to log trigger:", e.message);
    }
  }

  async logAction(auditId, actionName, status, details) {
    try {
      await WorkflowAudit.findByIdAndUpdate(auditId, {
        $push: {
          actionsExecuted: {
            action: actionName,
            status,
            details,
            timestamp: new Date()
          }
        }
      });
    } catch (e) {
      console.error("[WORKFLOW AUDIT LOGGER] Failed to log action:", e.message);
    }
  }

  async logEscalation(auditId, escalationEvent) {
    try {
      await WorkflowAudit.findByIdAndUpdate(auditId, {
        $push: { escalationEvents: escalationEvent },
        status: 'active'
      });
    } catch (e) {
      console.error("[WORKFLOW AUDIT LOGGER] Failed to log escalation:", e.message);
    }
  }

  async logApproval(auditId, approvedBy, status) {
    try {
      await WorkflowAudit.findByIdAndUpdate(auditId, {
        approvalStatus: status,
        approvedBy,
        status: status === 'approved' ? 'active' : 'cancelled'
      });
    } catch (e) {
      console.error("[WORKFLOW AUDIT LOGGER] Failed to log approval:", e.message);
    }
  }

  async completeWorkflow(auditId) {
    try {
      await WorkflowAudit.findByIdAndUpdate(auditId, { status: 'completed' });
    } catch (e) {
      console.error("[WORKFLOW AUDIT LOGGER] Failed to complete workflow:", e.message);
    }
  }
}

module.exports = new WorkflowAuditLogger();
