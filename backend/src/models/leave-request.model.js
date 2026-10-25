const mongoose = require('mongoose')

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    startDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    endDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
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
    reviewComment: {
      type: String,
      default: null,
      maxlength: 1000,
    },
  },
  { timestamps: true, versionKey: false },
)

leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1, status: 1 })
leaveRequestSchema.index({ status: 1, createdAt: -1 })
leaveRequestSchema.index({ leaveType: 1, status: 1, startDate: 1, endDate: 1 })

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema)
