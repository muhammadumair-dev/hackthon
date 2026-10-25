const mongoose = require('mongoose')

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    requestedCheckIn: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    requestedCheckOut: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    comment: {
      type: String,
      default: null,
      maxlength: 500,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
)

attendanceCorrectionSchema.index(
  { employee: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)
attendanceCorrectionSchema.index({ status: 1, createdAt: 1 })

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema)
