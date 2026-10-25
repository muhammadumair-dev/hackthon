const crypto = require('node:crypto')
const LoginAttempt = require('../models/login-attempt.model')
const AppError = require('../utils/app-error')

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

const getKey = (email, ip) => crypto
  .createHash('sha256')
  .update(`${email.toLowerCase()}:${ip}`)
  .digest('hex')

const assertAllowed = async (key) => {
  const attempt = await LoginAttempt.findOne({ key }).lean()
  if (
    attempt &&
    attempt.windowStartedAt.getTime() + WINDOW_MS > Date.now() &&
    attempt.count >= MAX_FAILURES
  ) {
    throw new AppError(429, 'Too many failed login attempts. Try again in 15 minutes.')
  }
}

const recordFailure = async (key) => {
  const now = new Date()
  const cutoff = new Date(now.getTime() - WINDOW_MS)
  await LoginAttempt.updateOne(
    { key },
    { $setOnInsert: { key, count: 0, windowStartedAt: now, updatedAt: now } },
    { upsert: true },
  )
  await LoginAttempt.findOneAndUpdate(
    { key },
    [{
      $set: {
        count: {
          $cond: [
            { $lt: ['$windowStartedAt', cutoff] },
            1,
            { $add: ['$count', 1] },
          ],
        },
        windowStartedAt: {
          $cond: [
            { $lt: ['$windowStartedAt', cutoff] },
            { $literal: now },
            '$windowStartedAt',
          ],
        },
        updatedAt: { $literal: now },
      },
    }],
    { updatePipeline: true },
  )
}

const clearFailures = async (key) => {
  await LoginAttempt.deleteOne({ key })
}

module.exports = { getKey, assertAllowed, recordFailure, clearFailures }