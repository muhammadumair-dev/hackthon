const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const serializeUser = require('../utils/serialize-user')

const createToken = (user) => {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith('replace_with')
  ) {
    throw new AppError(500, 'Authentication is not configured correctly.')
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      employeeId: user.employeeId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d', algorithm: 'HS256' },
  )
}

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'Email or password is incorrect.')
  }

  return {
    token: createToken(user),
    user: serializeUser(user),
  }
}

const changePassword = async ({ user, currentPassword, newPassword }) => {
  const userWithPassword = await User.findById(user._id).select('+passwordHash')

  if (
    !userWithPassword ||
    !(await bcrypt.compare(currentPassword, userWithPassword.passwordHash))
  ) {
    throw new AppError(401, 'Current password is incorrect.')
  }

  userWithPassword.passwordHash = await bcrypt.hash(newPassword, 12)
  userWithPassword.mustChangePassword = false
  await userWithPassword.save()

  return serializeUser(userWithPassword)
}

module.exports = { login, changePassword }
