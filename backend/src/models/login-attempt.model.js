const mongoose = require('mongoose')

const loginAttemptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    windowStartedAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
)

loginAttemptSchema.index({ updatedAt:  1 }, { expireAfterSeconds: 3600 })

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema)