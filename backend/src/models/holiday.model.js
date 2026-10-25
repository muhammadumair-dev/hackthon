const mongoose = require('mongoose')

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  { timestamps: true, versionKey: false },
)

module.exports = mongoose.model('Holiday', holidaySchema)
