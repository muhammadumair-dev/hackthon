const AppError = require('../utils/app-error')

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication is required.'))
  }

  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'You are not allowed to access this resource.'))
  }

  return next()
}

module.exports = authorizeRoles
