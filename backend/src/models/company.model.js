const mongoose = require('mongoose')

const companySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: 'primary',
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    officeStart: {
      type: String,
      required: true,
      default: '09:00',
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    graceMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
      max: 240,
    },
    halfDayHours: {
      type: Number,
      required: true,
      default: 5,
      min: 0.5,
      max: 24,
    },
    weekend: {
      type: [String],
      required: true,
      default: ['Sat', 'Sun'],
      validate: {
        validator: (days) =>
          new Set(days).size === days.length &&
          days.every((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(day)),
        message: 'Weekend must contain unique valid weekday names.',
      },
    },
    officeLatitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },
    officeLongitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },
    radiusMeters: {
      type: Number,
      required: true,
      default: 150,
      min: 1,
      max: 100000,
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Karachi',
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

module.exports = mongoose.model('Company', companySchema)
