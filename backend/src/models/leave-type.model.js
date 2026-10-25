const mongoose = require('mongoose')

const leaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    yearlyQuota: {
      type: Number,
      default: null,
      min: 0,
      required: function requiredQuota() {
        return !this.isUnlimited
      },
    },
    isUnlimited: {
      type: Boolean,
      required: true,
      default: false,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
)

leaveTypeSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)

module.exports = mongoose.model('LeaveType', leaveTypeSchema)
