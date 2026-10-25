const mongoose = require('mongoose')

const payrollRunSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'finalized'],
      default: 'draft',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalizedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
)

payrollRunSchema.index({ month: 1 }, { unique: true })

module.exports = mongoose.model('PayrollRun', payrollRunSchema)
