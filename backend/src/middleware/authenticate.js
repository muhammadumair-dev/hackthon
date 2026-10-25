const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')

const authenticate = async (req, res, next) => {
  const authorization = req.get('authorization')
  const [scheme, token] = authorization ? authorization.split(' ') : []

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Authentication is required.'))
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return next(new AppError(401, 'Authentication token is invalid.'))
  }

  if (
    typeof payload !== 'object' ||
    typeof payload.userId !== 'string' ||
    !['admin', 'hr', 'employee'].includes(payload.role)
  ) {
    return next(new AppError(401, 'Authentication token is invalid.'))
  }

  let user
  try {
    user = await User.findById(payload.userId)
  } catch (error) {
    return next(error)
  }

  if (!user || !user.isActive) {
    return next(new AppError(401, 'Authentication token is invalid.'))
  }

  req.user = user
  return next()
}

module.exports = authenticate
