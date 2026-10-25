const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const validateParams = require('../middleware/validate-params')
const controller = require('../controllers/payroll.controller')

const idParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
}).strict()
const createRunSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  regenerate: z.boolean().optional().default(false),
}).strict()
const emptyBodySchema = z.object({}).strict().default({})
const router = express.Router()

router.post(
  '/runs',
  authorizeRoles('hr'),
  validateBody(createRunSchema),
  controller.createRun,
)
router.get('/runs', authorizeRoles('admin', 'hr'), controller.listRuns)
router.get(
  '/runs/:id',
  authorizeRoles('admin', 'hr'),
  validateParams(idParamsSchema),
  controller.getRun,
)
router.post(
  '/runs/:id/finalize',
  authorizeRoles('admin'),
  validateParams(idParamsSchema),
  validateBody(emptyBodySchema),
  controller.finalizeRun,
)
router.get(
  '/payslips/my',
  authorizeRoles('employee'),
  controller.getMyPayslips,
)
router.get(
  '/payslips/:id/pdf',
  authorizeRoles('admin', 'hr', 'employee'),
  validateParams(idParamsSchema),
  controller.downloadPayslip,
)

module.exports = router
