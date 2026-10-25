const mongoose = require('mongoose')

const designationSchema = new mongoose.Schema(
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

designationSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)

module.exports = mongoose.model('Designation', designationSchema)
