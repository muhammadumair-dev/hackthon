const { z } = require('zod')

const isIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

const isoDateSchema = z.string().refine(isIsoDate, {
  message: 'Date must be a valid ISO date in YYYY-MM-DD format.',
})

const employeePayloadSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: z.string().trim().min(1).max(40),
  address: z.string().trim().min(1).max(500),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  department: z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid department.'),
  designation: z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid designation.'),
  joinDate: isoDateSchema,
  status: z.enum(['active', 'probation', 'exited']),
  exitDate: isoDateSchema.nullable().optional(),
  basicSalary: z.number().finite().positive(),
}).strict()

module.exports = { isIsoDate, employeePayloadSchema }
