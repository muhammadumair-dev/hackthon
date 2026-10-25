const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const validateParams = require('../middleware/validate-params')
const validateQuery = require('../middleware/validate-query')
const controller = require('../controllers/leave.controller')
const { isIsoDate } = require('../utils/attendance-time')

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
const dateSchema = z.string().refine(isIsoDate, 'Date must be a valid YYYY-MM-DD date.')
const workdaysQuerySchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
}).strict()
const requestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).optional(),
  department: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict()
const createLeaveSchema = z.object({
  leaveType: objectIdSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  reason: z.string().trim().min(1).max(1000),
}).strict()
const reviewSchema = z.object({
  comment: z.string().trim().min(1).max(1000),
}).strict()
const paramsSchema = z.object({ id: objectIdSchema }).strict()
const emptyBodySchema = z.object({}).strict().default({})

const router = express.Router()

router.get('/balance', authorizeRoles('employee'), controller.getBalance)
router.get(
  '/workdays',
  authorizeRoles('employee'),
  validateQuery(workdaysQuerySchema),
  controller.getWorkdays,
)
router.post(
  '/',
  authorizeRoles('employee'),
  validateBody(createLeaveSchema),
  controller.createLeave,
)
router.get('/my', authorizeRoles('employee'), controller.getMyLeaves)
router.post(
  '/:id/cancel',
  authorizeRoles('employee'),
  validateParams(paramsSchema),
  validateBody(emptyBodySchema),
  controller.cancelLeave,
)
router.get(
  '/requests',
  authorizeRoles('admin', 'hr'),
  validateQuery(requestsQuerySchema),
  controller.listRequests,
)
router.post(
  '/:id/approve',
  authorizeRoles('hr'),
  validateParams(paramsSchema),
  validateBody(reviewSchema),
  controller.approveLeave,
)
router.post(
  '/:id/reject',
  authorizeRoles('hr'),
  validateParams(paramsSchema),
  validateBody(reviewSchema),
  controller.rejectLeave,
)

module.exports = router
