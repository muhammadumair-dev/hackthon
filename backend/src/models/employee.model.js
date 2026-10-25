const mongoose = require('mongoose')

const employeeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    gender: {
      type: String,
      required: true,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
      required: true,
    },
    joinDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'probation', 'exited'],
      default: 'probation',
    },
    exitDate: {
      type: String,
      default: null,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true, versionKey: false },
)

employeeSchema.index(
  { code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)
employeeSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)
employeeSchema.index({ department: 1, status: 1 })
employeeSchema.index({ name: 1 })

module.exports = mongoose.model('Employee', employeeSchema)
