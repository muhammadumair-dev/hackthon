const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema(
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
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['present', 'late', 'half_day', 'absent', 'missing_checkout', 'on_leave'],
    },
    workedHours: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      required: true,
      enum: ['web'],
      default: 'web',
    },
    note: {
      type: String,
      default: null,
      maxlength: 200,
    },
  },
  { timestamps: true, versionKey: false },
)

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true })
attendanceSchema.index({ date: 1, status: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)
