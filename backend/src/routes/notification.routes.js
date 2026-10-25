const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const validateParams = require('../middleware/validate-params')
const controller = require('../controllers/notification.controller')

const paramsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
}).strict()
const emptyBodySchema = z.object({}).strict().default({})
const router = express.Router()

router.get('/', authorizeRoles('admin', 'hr', 'employee'), controller.listNotifications)
router.post(
  '/:id/read',
  authorizeRoles('admin', 'hr', 'employee'),
  validateParams(paramsSchema),
  validateBody(emptyBodySchema),
  controller.markAsRead,
)

module.exports = router
