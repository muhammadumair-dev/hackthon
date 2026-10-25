const express = require('express')
const { z } = require('zod')
const authorizeRoles = require('../middleware/authorize-roles')
const validateBody = require('../middleware/validate-body')
const controller = require('../controllers/announcement.controller')

const router = express.Router()
const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(3000),
}).strict()

router.get('/', authorizeRoles('admin', 'hr', 'employee'), controller.listAnnouncements)
router.post(
  '/',
  authorizeRoles('admin', 'hr'),
  validateBody(announcementSchema),
  controller.createAnnouncement,
)

module.exports = router