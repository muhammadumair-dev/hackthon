const serializeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId || null,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
})

module.exports = serializeUser
