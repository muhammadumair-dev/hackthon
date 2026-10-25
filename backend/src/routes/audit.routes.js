const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateQuery = require('../middleware/validate-query')
const controller = require('../controllers/audit.controller')

const router = express.Router()
const querySchema = z.object({
  action: z.string().trim().min(1).max(100).optional(),
  entityType: z.string().trim().min(1).max(100).optional(),
  actor: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'from must be earlier than or equal to to.' },
)

router.get('/', authorizeRoles('admin'), validateQuery(querySchema), controller.listAuditLogs)

module.exports = router