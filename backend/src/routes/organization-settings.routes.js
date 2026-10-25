const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const controller = require('../controllers/organization-settings.controller')

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const companySettingsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  officeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  graceMinutes: z.number().int().min(0).max(240).optional(),
  halfDayHours: z.number().min(0.5).max(24).optional(),
  weekend: z.array(z.enum(weekdays)).max(7).refine(
    (days) => new Set(days).size === days.length,
    'Weekend days must be unique.',
  ).optional(),
  officeLatitude: z.number().min(-90).max(90).nullable().optional(),
  officeLongitude: z.number().min(-180).max(180).nullable().optional(),
  radiusMeters: z.number().int().min(1).max(100000).optional(),
  timezone: z.string().trim().min(1).max(100).refine((timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
      return true
    } catch {
      return false
    }
  }, 'Timezone must be a valid IANA timezone.').optional(),
}).strict().refine((settings) => Object.keys(settings).length > 0, {
  message: 'Provide at least one setting to update.',
})

const nameSchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict()

const leaveTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  yearlyQuota: z.number().min(0).nullable(),
  isUnlimited: z.boolean(),
  isPaid: z.boolean(),
}).strict().refine(
  ({ yearlyQuota, isUnlimited }) => isUnlimited ? yearlyQuota === null : yearlyQuota !== null,
  {
    message: 'Unlimited leave types must have a null quota; limited types need a numeric quota.',
    path: ['yearlyQuota'],
  },
)

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'Date must be a valid calendar date in YYYY-MM-DD format.'),
  name: z.string().trim().min(1).max(120),
}).strict()

const hrUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
}).strict()

const hrUserStatusSchema = z.object({
  isActive: z.boolean(),
}).strict()

const resourceSchemas = {
  departments: nameSchema,
  designations: nameSchema,
  'leave-types': leaveTypeSchema,
  holidays: holidaySchema,
}

const createCatalogRouter = (resource) => {
  const router = express.Router()
  const schema = resourceSchemas[resource]
  const authorizeRead = authorizeRoles('admin', 'hr')
  const authorizeWrite = authorizeRoles('admin')
  const setResource = (req, res, next) => {
    req.settingResource = resource
    next()
  }

  router.get('/', authorizeRead, setResource, controller.listResource)
  router.post('/', authorizeWrite, validateBody(schema), setResource, controller.createResource)
  router.patch('/:id', authorizeWrite, validateBody(schema), setResource, controller.updateResource)
  router.delete('/:id', authorizeWrite, setResource, controller.deleteResource)
  return router
}

const router = express.Router()

router.get('/company', authorizeRoles('admin', 'hr'), controller.getCompany)
router.patch(
  '/company',
  authorizeRoles('admin'),
  validateBody(companySettingsSchema),
  controller.updateCompany,
)

for (const resource of Object.keys(resourceSchemas)) {
  router.use(`/${resource}`, createCatalogRouter(resource))
}

router.get('/hr-users', authorizeRoles('admin', 'hr'), controller.listHrUsers)
router.post(
  '/hr-users',
  authorizeRoles('admin'),
  validateBody(hrUserSchema),
  controller.createHrUser,
)
router.patch(
  '/hr-users/:id',
  authorizeRoles('admin'),
  validateBody(hrUserStatusSchema),
  controller.updateHrUserStatus,
)
router.post(
  '/hr-users/:id/reset-password',
  authorizeRoles('admin'),
  controller.resetHrUserPassword,
)

module.exports = router
