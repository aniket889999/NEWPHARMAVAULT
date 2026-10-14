const workflowSafetyGuard = require('./workflowSafetyGuard');
const escalationEngine = require('./escalationEngine');
const notificationAutomation = require('./notificationAutomation');
const workflowAuditLogger = require('./workflowAuditLogger');

class WorkflowExecutor {
  async execute(workflow, auditId, context) {
    console.log(`[WORKFLOW EXECUTOR] Starting execution of ${workflow.name} (${auditId})`);
    
    // Check if it's waiting for approval
    if (workflow.requireApproval && context.approvalStatus !== 'approved') {
      await workflowAuditLogger.logAction(auditId, 'wait_for_approval', 'pending', { role: workflow.approverRole });
      return; // Execution stops until approved
    }

    let hasFailure = false;

    for (const action of workflow.actions) {
      // 1. Safety check
      const safetyCheck = workflowSafetyGuard.validateAction(workflow, action, context);
      if (!safetyCheck.safe) {
        await workflowAuditLogger.logAction(auditId, action, 'failed', { reason: safetyCheck.reason });
        
        // Auto-escalate on safety block
        const escalation = escalationEngine.escalate(workflow, context, `Safety guard blocked action: ${action}`);
        await workflowAuditLogger.logEscalation(auditId, escalation);
        hasFailure = true;
        break; // Stop further actions
      }

      // 2. Execute Action (Simulation of actual integration)
      try {
        // Simple routing of actions to mock subsystems
        if (action === 'notify_patient') {
           notificationAutomation.notify('patient', context.notificationType || 'default', context);
        } else if (action === 'notify_pharmacist') {
           notificationAutomation.notify('pharmacist', context.notificationType || 'default', context);
        } else if (action === 'alert_pharmacist_critical') {
           notificationAutomation.notify('pharmacist', 'safety_warning', context);
        } else if (action === 'queue_for_review') {
           // Queued item context for review logic
        }
        
        await workflowAuditLogger.logAction(auditId, action, 'completed', { executedAt: new Date() });
      } catch (err) {
        await workflowAuditLogger.logAction(auditId, action, 'failed', { error: err.message });
        hasFailure = true;
        break;
      }
    }

    if (!hasFailure) {
      await workflowAuditLogger.completeWorkflow(auditId);
    }
  }
}

module.exports = new WorkflowExecutor();
