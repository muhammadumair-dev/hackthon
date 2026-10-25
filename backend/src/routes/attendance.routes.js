const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const validateParams = require('../middleware/validate-params')
const validateQuery = require('../middleware/validate-query')
const controller = require('../controllers/attendance.controller')
const { isIsoDate } = require('../utils/attendance-time')

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const dateSchema = z.string().refine(isIsoDate, 'Date must be a valid YYYY-MM-DD date.')
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const myQuerySchema = z.object({
  month: monthSchema,
}).strict()
const boardQuerySchema = z.object({
  date: dateSchema,
  department: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict()
const correctionSchema = z.object({
  date: dateSchema,
  requestedCheckIn: timeSchema,
  requestedCheckOut: timeSchema,
  reason: z.string().trim().min(1).max(500),
}).strict()
const reviewSchema = z.object({
  comment: z.string().trim().min(1).max(500),
}).strict()
const correctionParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
}).strict()
const emptyBodySchema = z.object({}).strict().default({})

const router = express.Router()

router.post(
  '/check-in',
  authorizeRoles('employee'),
  validateBody(emptyBodySchema),
  controller.checkIn,
)
router.post(
  '/check-out',
  authorizeRoles('employee'),
  validateBody(emptyBodySchema),
  controller.checkOut,
)
router.get('/my', authorizeRoles('employee'), validateQuery(myQuerySchema), controller.getMyAttendance)
router.get(
  '/board',
  authorizeRoles('admin', 'hr'),
  validateQuery(boardQuerySchema),
  controller.getAttendanceBoard,
)
router.post(
  '/corrections',
  authorizeRoles('employee'),
  validateBody(correctionSchema),
  controller.requestCorrection,
)
router.get('/corrections', authorizeRoles('admin', 'hr', 'employee'), controller.listCorrections)
router.post(
  '/corrections/:id/approve',
  authorizeRoles('hr'),
  validateParams(correctionParamsSchema),
  validateBody(reviewSchema),
  controller.approveCorrection,
)
router.post(
  '/corrections/:id/reject',
  authorizeRoles('hr'),
  validateParams(correctionParamsSchema),
  validateBody(reviewSchema),
  controller.rejectCorrection,
)

module.exports = router
