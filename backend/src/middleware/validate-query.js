const AppError = require('../utils/app-error')

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query)

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

  req.validatedQuery = result.data
  return next()
}

module.exports = validateQuery
