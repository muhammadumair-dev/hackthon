const cors = require('cors')
const express = require('express')
const authenticate = require('./middleware/authenticate')
const errorHandler = require('./middleware/error-handler')
const requirePasswordChangeComplete = require('./middleware/require-password-change-complete')
const healthRoutes = require('./routes/health.routes')
const setupRoutes = require('./routes/setup.routes')
const authRoutes = require('./routes/auth.routes')
const organizationSettingsRoutes = require('./routes/organization-settings.routes')
const employeeRoutes = require('./routes/employee.routes')
const attendanceRoutes = require('./routes/attendance.routes')
const leaveRoutes = require('./routes/leave.routes')
const notificationRoutes = require('./routes/notification.routes')
const payrollRoutes = require('./routes/payroll.routes')
const dashboardRoutes = require('./routes/dashboard.routes')
const aiRoutes = require('./routes/ai.routes')
const auditRoutes = require('./routes/audit.routes')
const announcementRoutes = require('./routes/announcement.routes')
const AppError = require('./utils/app-error')
const { requireRuntimeConfig } = require('./utils/runtime-config')
const { ensureMongoConnection } = require('./utils/mongo-connection')

const app = express()

const allowedOrigins = () => (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.use(requireRuntimeConfig)
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins().includes(origin.replace(/\/$/, ''))) {
      return callback(null, true)
    }
    return callback(new AppError(403, 'This origin is not allowed by CORS.'))
  },
  optionsSuccessStatus: 204,
}))
app.use(express.json({ limit: '3mb' }))
app.use(ensureMongoConnection)

app.use('/api', (req, res, next) => {
  const publicRoutes = new Set([
    'GET /health',
    'GET /setup/status',
    'POST /setup',
    'POST /auth/login',
  ])
  const passwordChangeRoutes = new Set([
    'GET /auth/me',
    'POST /auth/change-password',
  ])
  const routeKey = `${req.method} ${req.path}`

  if (publicRoutes.has(routeKey)) {
    return next()
  }

  return authenticate(req, res, (error) => {
    if (error) {
      return next(error)
    }

    if (!passwordChangeRoutes.has(routeKey)) {
      return requirePasswordChangeComplete(req, res, next)
    }

    return next()
  })
})

app.use('/api/health', healthRoutes)
app.use('/api/setup', setupRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/settings', organizationSettingsRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leave', leaveRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/payroll', payrollRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use('/api/announcements', announcementRoutes)

app.use('/api', (req, res, next) => {
  next(new AppError(404, 'API endpoint not found.'))
})

app.use(errorHandler)

module.exports = app
