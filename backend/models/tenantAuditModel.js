const mongoose = require('mongoose');

const tenantAuditSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  metadata: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

tenantAuditSchema.statics.logAction = async function(data) {
  return await this.create({
    organizationId: data.organizationId,
    branchId: data.branchId,
    actorId: data.actorId,
    action: data.action,
    module: data.module,
    metadata: data.metadata
  });
};

module.exports = mongoose.model('TenantAudit', tenantAuditSchema);
