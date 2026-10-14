const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      required: true, 
      enum: ['patient', 'pharmacy', 'admin', 'doctor', 'agent', 'super_admin', 'org_admin', 'branch_manager', 'pharmacist', 'auditor', 'claims_reviewer', 'research_evaluator'],
      default: 'patient',
      index: true
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true
    },
    // Future-ready metadata for GraphRAG & Agents
    metadata: {
      type: Map,
      of: String,
      default: {}
    }
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
