const mongoose = require('mongoose')

const aiRequestWindowSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    requestTimes: {
      type: [Date],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
)

aiRequestWindowSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7200 })

module.exports = mongoose.model('AiRequestWindow', aiRequestWindowSchema)
