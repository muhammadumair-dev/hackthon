const AppError = require('../utils/app-error')

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params)

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

  req.validatedParams = result.data
  return next()
}

module.exports = validateParams
