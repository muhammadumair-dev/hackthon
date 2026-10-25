const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const validateQuery = require('../middleware/validate-query')
const validateParams = require('../middleware/validate-params')
const controller = require('../controllers/employee.controller')
const { employeePayloadSchema } = require('../utils/employee-validation')

const departmentIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const listQuerySchema = z.object({
  search: z.string().max(100).optional(),
  department: departmentIdSchema.optional(),
  status: z.enum(['active', 'probation', 'exited']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict()
const exportQuerySchema = listQuerySchema.omit({ page: true, pageSize: true }).strict()
const importQuerySchema = z.object({
  dryRun: z.enum(['true', 'false']),
}).strict()
const employeeIdParamsSchema = z.object({
  id: departmentIdSchema,
}).strict()

const csvSchema = z.object({
  csv: z.string().min(1, 'CSV content is required.').max(2_000_000, 'CSV must be no larger than 2 MB.'),
}).strict()

const employeeProfileSchema = z.object({
  phone: z.string().trim().min(1).max(40),
  address: z.string().trim().min(1).max(500),
}).strict()

const loginStatusSchema = z.object({
  isActive: z.boolean(),
}).strict()

const router = express.Router()

router.get(
  '/',
  authorizeRoles('admin', 'hr'),
  validateQuery(listQuerySchema),
  controller.listEmployees,
)
router.post(
  '/',
  authorizeRoles('hr'),
  validateBody(employeePayloadSchema),
  controller.createEmployee,
)
router.get(
  '/export',
  authorizeRoles('hr'),
  validateQuery(exportQuerySchema),
  controller.exportEmployees,
)
router.post(
  '/import',
  authorizeRoles('hr'),
  validateQuery(importQuerySchema),
  validateBody(csvSchema),
  controller.importEmployees,
)
router.get('/me', authorizeRoles('employee'), controller.getMyEmployee)
router.put(
  '/me',
  authorizeRoles('employee'),
  validateBody(employeeProfileSchema),
  controller.updateMyEmployee,
)
router.patch(
  '/:id/login',
  authorizeRoles('hr'),
  validateParams(employeeIdParamsSchema),
  validateBody(loginStatusSchema),
  controller.updateEmployeeLoginStatus,
)
router.post(
  '/:id/reset-password',
  authorizeRoles('hr'),
  validateParams(employeeIdParamsSchema),
  controller.resetEmployeePassword,
)
router.get(
  '/:id',
  authorizeRoles('admin', 'hr', 'employee'),
  validateParams(employeeIdParamsSchema),
  controller.getEmployee,
)
router.put(
  '/:id',
  authorizeRoles('hr', 'employee'),
  validateParams(employeeIdParamsSchema),
  (req, res, next) => {
    const schema = req.user.role === 'employee' ? employeeProfileSchema : employeePayloadSchema
    return validateBody(schema)(req, res, next)
  },
  controller.updateEmployee,
)

module.exports = router
