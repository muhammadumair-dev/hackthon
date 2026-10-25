const mongoose = require('mongoose')

const payrollItemSchema = new mongoose.Schema(
  {
    run: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    basic: { type: Number, required: true, min: 0 },
    hra: { type: Number, required: true, min: 0 },
    medical: { type: Number, required: true, min: 0 },
    gross: { type: Number, required: true, min: 0 },
    workingDays: { type: Number, required: true, min: 0 },
    absentDays: { type: Number, required: true, min: 0 },
    unpaidLeaveDays: { type: Number, required: true, min: 0 },
    halfDays: { type: Number, required: true, min: 0 },
    deduction: { type: Number, required: true, min: 0 },
    annualTax: { type: Number, required: true, min: 0 },
    monthlyTax: { type: Number, required: true, min: 0 },
    netPay: { type: Number, required: true },
    daysPayable: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
)

payrollItemSchema.index({ run: 1, employee: 1 }, { unique: true })
payrollItemSchema.index({ employee: 1, run: 1 })

module.exports = mongoose.model('PayrollItem', payrollItemSchema)
