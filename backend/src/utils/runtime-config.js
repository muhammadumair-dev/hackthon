const AppError = require('./app-error')

const validateRuntimeConfig = () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.')
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required.')
  }
  if (
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith('replace_with')
  ) {
    throw new Error('JWT_SECRET must be a private value with at least 32 characters.')
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL is required.')
  }
}

const requireRuntimeConfig = (req, res, next) => {
  try {
    validateRuntimeConfig()
    next()
  } catch (error) {
    next(new AppError(503, error.message))
  }
}

module.exports = { validateRuntimeConfig, requireRuntimeConfig }
