const express = require('express')
const { z } = require('zod')
const {
  loginUser,
  changeUserPassword,
  getCurrentUser,
} = require('../controllers/auth.controller')
const validateBody = require('../middleware/validate-body')

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password must be no longer than 72 UTF-8 bytes.',
  })

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    { message: 'Password must be no longer than 72 UTF-8 bytes.' },
  ),
}).strict()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    { message: 'Password must be no longer than 72 UTF-8 bytes.' },
  ),
  newPassword: passwordSchema,
}).strict().refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from the current password.',
  path: ['newPassword'],
})

const router = express.Router()

router.post('/login', validateBody(loginSchema), loginUser)
router.get('/me', getCurrentUser)
router.post(
  '/change-password',
  validateBody(changePasswordSchema),
  changeUserPassword,
)

module.exports = router
