const AppError = require('../utils/app-error')

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)

  if (!result.success) {
    return next(
      new AppError(
        400,
        JSON.stringify(
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      ),
    )
  }

  req.body = result.data
  return next()
}

module.exports = validateBody
