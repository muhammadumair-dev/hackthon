const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ['admin', 'hr', 'employee'],
    },
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entityId: { type: String, default: null, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

auditLogSchema.index({ createdAt: -1, _id: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)