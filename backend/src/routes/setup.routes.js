const express = require('express')
const { z } = require('zod')
const { setupStatus, createSetup } = require('../controllers/setup.controller')
const validateBody = require('../middleware/validate-body')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password must be no longer than 72 UTF-8 bytes.',
  })

const setupSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  adminName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: passwordSchema,
}).strict()

const router = express.Router()

router.get('/status', setupStatus)
router.post('/', validateBody(setupSchema), createSetup)

module.exports = router
