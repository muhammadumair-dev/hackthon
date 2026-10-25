const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  { timestamps: true, versionKey: false },
)

departmentSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)

module.exports = mongoose.model('Department', departmentSchema)
