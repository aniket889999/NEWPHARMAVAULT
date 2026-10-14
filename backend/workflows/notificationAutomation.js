class NotificationAutomation {
  notify(targetRole, templateType, context) {
    let message = "";
    
    switch (templateType) {
      case 'refill_reminder':
        message = `Refill Reminder: Your ${context.medicineName || 'medicine'} may run out in ${context.daysRemaining || 3} days.`;
        break;
      case 'expiry_warning':
        message = `Expiry Alert: ${context.medicineName} is expiring in ${context.daysToExpiry} days.`;
        break;
      case 'review_required':
        message = `Review Required: A prescription or AI output requires pharmacist review. Reason: ${context.reviewReason || 'Low confidence'}.`;
        break;
      case 'low_stock':
        message = `Low Stock Alert: ${context.medicineName} is running low (${context.stockLevel} units left).`;
        break;
      case 'safety_warning':
        message = `Safety Warning: A severe interaction or contradiction was detected. Please review immediately.`;
        break;
      case 'missed_dose':
        message = `Adherence Alert: You seem to have missed your recent doses of ${context.medicineName}.`;
        break;
      default:
        message = `Notification: ${templateType} triggered.`;
    }

    const severities = {
      'safety_warning': 'Critical',
      'expiry_warning': 'High',
      'review_required': 'High',
      'low_stock': 'Medium',
      'refill_reminder': 'Low',
      'missed_dose': 'Medium'
    };

    const notificationPayload = {
      targetRole,
      message,
      type: templateType,
      severity: severities[templateType] || 'Low',
      timestamp: new Date(),
      contextId: context.id || 'N/A',
      deliveryStatus: 'sent',
      metadata: {
        pharmacyId: context.pharmacyId,
        userId: context.userId
      }
    };

    return notificationPayload;
  }
}

module.exports = new NotificationAutomation();
