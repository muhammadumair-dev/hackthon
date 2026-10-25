const AppError = require('../utils/app-error')

const requirePasswordChangeComplete = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return next(new AppError(403, 'Change your password before using this resource.'))
  }

  return next()
}

module.exports = requirePasswordChangeComplete
