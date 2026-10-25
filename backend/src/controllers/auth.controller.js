const { login, changePassword } = require('../services/auth.service')
const loginRateLimit = require('../services/login-rate-limit.service')
const serializeUser = require('../utils/serialize-user')

const loginUser = async (req, res) => {
  const key = loginRateLimit.getKey(req.body.email, req.ip)
  await loginRateLimit.assertAllowed(key)
  try {
    const result = await login(req.body)
    await loginRateLimit.clearFailures(key)
    res.status(200).json(result)
  } catch (error) {
    if (error.status === 401) await loginRateLimit.recordFailure(key)
    throw error
  }
}

const changeUserPassword = async (req, res) => {
  const user = await changePassword({ user: req.user, ...req.body })
  res.status(200).json({ user })
}

const getCurrentUser = (req, res) => {
  res.status(200).json({ user: serializeUser(req.user) })
}

module.exports = { loginUser, changeUserPassword, getCurrentUser }
