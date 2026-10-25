const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const controller = require('../controllers/ai.controller')
const { isIsoDate } = require('../utils/attendance-time')

const filtersSchema = z.object({
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
  department: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict().refine(
  ({ from, to }) => Boolean(from) === Boolean(to) && (!from || from <= to),
  { message: 'Provide both valid from and to dates, with from on or before to.' },
)
const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000),
  }).strict()).max(20).optional().default([]),
}).strict()
const dashboardSummarySchema = z.object({
  kpis: z.record(z.string(), z.unknown()),
  filters: filtersSchema,
}).strict().refine(
  ({ kpis }) => {
    try {
      return Buffer.byteLength(JSON.stringify(kpis), 'utf8') <= 20000
    } catch {
      return false
    }
  },
  { message: 'Dashboard KPI payload must be valid JSON under 20 KB.' },
)
const smartLeaveSchema = z.object({
  text: z.string().trim().min(1).max(1000),
}).strict()

const router = express.Router()

router.post(
  '/chat',
  authorizeRoles('admin', 'hr', 'employee'),
  validateBody(chatSchema),
  controller.chat,
)
router.post(
  '/dashboard-summary',
  authorizeRoles('admin', 'hr'),
  validateBody(dashboardSummarySchema),
  controller.dashboardSummary,
)
router.post(
  '/smart-leave',
  authorizeRoles('employee'),
  validateBody(smartLeaveSchema),
  controller.smartLeave,
)

module.exports = router
