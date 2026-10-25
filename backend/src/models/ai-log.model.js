const mongoose = require('mongoose')

const aiLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'hr', 'employee'],
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    toolUsed: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ['processing', 'success', 'fallback', 'rate_limited'],
      default: 'processing',
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true, versionKey: false },
)

aiLogSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('AiLog', aiLogSchema, 'ai_logs')
