const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateQuery = require('../middleware/validate-query')
const controller = require('../controllers/dashboard.controller')
const { isIsoDate } = require('../utils/attendance-time')

const dateSchema = z.string().refine(isIsoDate, 'Date must be a valid YYYY-MM-DD date.').optional()
const filterSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  department: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict().refine(
  ({ from, to }) => (Boolean(from) === Boolean(to)) && (!from || from <= to),
  { message: 'Provide both from and to, and ensure from is on or before to.' },
)

const router = express.Router()

router.get(
  '/hr',
  authorizeRoles('admin', 'hr'),
  validateQuery(filterSchema),
  controller.getHrDashboard,
)
router.get(
  '/admin',
  authorizeRoles('admin'),
  validateQuery(filterSchema),
  controller.getAdminDashboard,
)
router.get(
  '/employee',
  authorizeRoles('employee'),
  controller.getEmployeeDashboard,
)

module.exports = router
