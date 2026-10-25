const AppError = require('../utils/app-error')

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error instanceof AppError) {
    const response = { message: error.message }
    if (error.status === 400) {
      try {
        response.errors = JSON.parse(error.message)
        response.message = 'Request validation failed.'
      } catch {
        response.message = 'Request validation failed.'
      }
    }
    return res.status(error.status).json(response)
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' })
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' })
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with these details already exists.' })
  }

  console.error('Request failed.', {
    name: error.name,
    code: error.code,
  })
  return res.status(500).json({ message: 'An unexpected server error occurred.' })
}

module.exports = errorHandler
