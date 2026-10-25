const { GoogleGenAI } = require('@google/genai')
const { z } = require('zod')
const AiLog = require('../models/ai-log.model')
const AiRequestWindow = require('../models/ai-request-window.model')
const analyticsService = require('./analytics.service')
const employeeService = require('./employee.service')
const leaveService = require('./leave.service')
const organizationSettingsService = require('./organization-settings.service')
const payrollService = require('./payroll.service')
const AppError = require('../utils/app-error')
const { getLocalDate, isIsoDate } = require('../utils/attendance-time')

const MODEL = 'gemini-2.5-flash'
const REQUEST_LIMIT = 20
const REQUEST_WINDOW_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15000
const MAX_TOOL_ROUNDS = 5
const FALLBACK_MESSAGE = 'Sorry, the AI assistant is temporarily unavailable. Please try again shortly.'

const dashboardFiltersSchema = z.object({
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
  department: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict().refine(
  ({ from, to }) => Boolean(from) === Boolean(to) && (!from || from <= to),
  { message: 'Provide both valid from and to dates, with from on or before to.' },
)

const toolFiltersSchema = dashboardFiltersSchema
const searchArgumentsSchema = z.object({
  search: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(10).optional().default(5),
}).strict()
const payrollArgumentsSchema = z.object({
  from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  to: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict().refine(({ from, to }) => Boolean(from) === Boolean(to) && (!from || from <= to), {
  message: 'Provide both valid from and to months.',
})

const smartLeaveResultSchema = z.object({
  type: z.string().regex(/^[a-f\d]{24}$/i),
  start: z.string().refine(isIsoDate),
  end: z.string().refine(isIsoDate),
  reason: z.string().trim().min(1).max(1000),
}).strict().refine(({ start, end }) => start <= end, {
  message: 'Leave end date must be on or after its start date.',
})

const summaryResultSchema = z.object({
  bullets: z.array(z.string().trim().min(1).max(500)).min(3).max(5),
}).strict()

const functionDeclarations = [
  {
    name: 'get_headcount',
    description: 'Get the current company headcount. Only Admin and HR can access company-wide headcount.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional start date in YYYY-MM-DD format.' },
        to: { type: 'string', description: 'Optional end date in YYYY-MM-DD format.' },
        department: { type: 'string', description: 'Optional department ObjectId.' },
      },
    },
  },
  {
    name: 'get_attendance_summary',
    description: 'Get attendance metrics for Admin/HR, or only the signed-in employee personal attendance metrics.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional start date in YYYY-MM-DD format.' },
        to: { type: 'string', description: 'Optional end date in YYYY-MM-DD format.' },
        department: { type: 'string', description: 'Optional department ObjectId; company roles only.' },
      },
    },
  },
  {
    name: 'get_late_comers',
    description: 'Get top late-comers for Admin/HR, or only the signed-in employee own late count.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional start date in YYYY-MM-DD format.' },
        to: { type: 'string', description: 'Optional end date in YYYY-MM-DD format.' },
        department: { type: 'string', description: 'Optional department ObjectId; company roles only.' },
      },
    },
  },
  {
    name: 'get_leave_summary',
    description: 'Get company leave usage for Admin/HR, or only the signed-in employee own leave balances.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional start date in YYYY-MM-DD format.' },
        to: { type: 'string', description: 'Optional end date in YYYY-MM-DD format.' },
        department: { type: 'string', description: 'Optional department ObjectId; company roles only.' },
      },
    },
  },
  {
    name: 'get_my_leave_balance',
    description: 'Get the authenticated employee own leave balance. This tool never accepts another employee identifier.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get company payroll totals for Admin/HR, or only the authenticated employee own latest finalized payslip.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional first payroll month in YYYY-MM format.' },
        to: { type: 'string', description: 'Optional last payroll month in YYYY-MM format.' },
      },
    },
  },
  {
    name: 'search_employees',
    description: 'Search employees for Admin/HR. Employees may only search their own profile. Salary and contact details are not returned.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Name, employee code, or email search text.' },
        limit: { type: 'number', description: 'Maximum results from 1 to 10.' },
      },
      required: ['search'],
    },
  },
]

const policyInstructions = [
  'You are the HCM Lite HR assistant. Follow the signed-in user role and the server-provided tool results.',
  'Never claim access to information not returned by an allowed tool. Never expose a colleague salary or private data to an Employee; politely refuse and explain that you can only help with their own information and public policy.',
  'Do not write, modify, approve, or save any records. Tools are read-only.',
  'Answer in the user language. Understand and respond naturally to Roman Urdu.',
  'Policy answers must use only these challenge rules; if the answer is not covered here, say "I don\'t know" (or the equivalent in the user language): office starts 09:00, grace period is 15 minutes, arriving after 09:15 is late, a shift under 5 hours is half-day; annual leave quota is 14 days, sick 8, casual 10, unpaid leave unlimited; only working days count and weekends/holidays are skipped; gross salary is 1.5 times basic (HRA 40% and medical 10% of basic); daily gross is monthly gross divided by working days; payroll deductions cover absent and unpaid leave days plus half of a day for each half-day; annual tax slabs are 0% through 600,000, 5% from 600,001 through 1,200,000, 30,000 plus 15% above 1,200,000 through 2,400,000, 210,000 plus 25% above 2,400,000 through 3,600,000, and 510,000 plus 35% above 3,600,000.',
].join(' ')

let aiClient

const getAiClient = () => {
  if (!process.env.AI_API_KEY) throw new Error('AI provider is not configured.')
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: process.env.AI_API_KEY })
  return aiClient
}

const setAiClientForTesting = (client) => {
  aiClient = client
}

const claimRequestSlot = async (userId, now = new Date()) => {
  try {
    await AiRequestWindow.updateOne(
      { user: userId },
      { $setOnInsert: { user: userId, requestTimes: [] } },
      { upsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const cutoff = new Date(now.getTime() - REQUEST_WINDOW_MS)
  const recentRequests = {
    $filter: {
      input: '$requestTimes',
      as: 'requestTime',
      cond: { $gt: ['$$requestTime', cutoff] },
    },
  }
  const updated = await AiRequestWindow.findOneAndUpdate(
    {
      user: userId,
      $expr: { $lt: [{ $size: recentRequests }, REQUEST_LIMIT] },
    },
    [{
      $set: {
        requestTimes: {
          $concatArrays: [recentRequests, { $literal: [now] }],
        },
        updatedAt: { $literal: now },
      },
    }],
    { returnDocument: 'after', updatePipeline: true },
  )
  return Boolean(updated)
}

const executeAiCall = async (user, message, operation) => {
  const startedAt = Date.now()
  let log
  try {
    log = await AiLog.create({
      user: user._id,
      role: user.role,
      message,
      toolUsed: [],
      status: 'processing',
    })
  } catch (error) {
    console.error('AI request could not be recorded.', {
      name: error.name,
      code: error.code,
    })
    throw new AppError(503, FALLBACK_MESSAGE)
  }
  const usedTools = new Set()
  const completeLog = async (nextStatus) => {
    try {
      await AiLog.findByIdAndUpdate(log._id, {
        $set: {
          toolUsed: [...usedTools],
          status: nextStatus,
          duration: Date.now() - startedAt,
        },
      })
    } catch (error) {
      console.error('AI request log could not be updated.', {
        name: error.name,
        code: error.code,
      })
      throw new AppError(503, FALLBACK_MESSAGE)
    }
  }

  let hasRequestSlot
  try {
    hasRequestSlot = await claimRequestSlot(user._id)
  } catch (error) {
    console.error('AI request rate limit could not be checked.', {
      name: error.name,
      code: error.code,
    })
    await completeLog('fallback')
    throw new AppError(503, FALLBACK_MESSAGE)
  }
  if (!hasRequestSlot) {
    await completeLog('rate_limited')
    throw new AppError(429, 'AI usage limit reached. Please try again after an hour.')
  }

  const abortController = new AbortController()
  let timeoutId
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort()
        reject(new Error('AI request timed out.'))
      }, REQUEST_TIMEOUT_MS)
    })
    const result = await Promise.race([
      operation(abortController.signal, usedTools),
      timeout,
    ])
    await completeLog(result ? 'success' : 'fallback')
    return result
  } catch {
    await completeLog('fallback')
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

const getCompanyDashboard = (user, filters = {}) => {
  if (user.role === 'admin') return analyticsService.getAdminDashboard(user, filters)
  if (user.role === 'hr') return analyticsService.getHrDashboard(user, filters)
  throw new AppError(403, 'Company analytics are not available to employees.')
}

const requireCompanyRole = (user) => {
  if (!['admin', 'hr'].includes(user.role)) {
    throw new AppError(403, 'This information is available only to Admin or HR.')
  }
}

const executeTool = async (name, args, user) => {
  switch (name) {
    case 'get_headcount': {
      requireCompanyRole(user)
      const filters = toolFiltersSchema.parse(args || {})
      const data = await getCompanyDashboard(user, filters)
      return { from: data.from, to: data.to, headcount: data.headcount }
    }
    case 'get_attendance_summary': {
      if (user.role === 'employee') {
        const data = await analyticsService.getEmployeeDashboard(user)
        return {
          today: data.today,
          week: data.week,
          lateCountThisMonth: data.lateCountThisMonth,
        }
      }
      const filters = toolFiltersSchema.parse(args || {})
      const data = await analyticsService.getHrDashboard(user, filters)
      return {
        from: data.from,
        to: data.to,
        presentToday: data.presentToday,
        onLeaveToday: data.onLeaveToday,
        lateToday: data.lateToday,
        attendanceTrend: data.attendanceTrend,
      }
    }
    case 'get_late_comers': {
      if (user.role === 'employee') {
        const data = await analyticsService.getEmployeeDashboard(user)
        return { lateCountThisMonth: data.lateCountThisMonth }
      }
      const filters = toolFiltersSchema.parse(args || {})
      const data = await analyticsService.getHrDashboard(user, filters)
      return { from: data.from, to: data.to, topLateComers: data.topLateComers }
    }
    case 'get_leave_summary': {
      if (user.role === 'employee') {
        const data = await analyticsService.getEmployeeDashboard(user)
        return data.leaveBalance
      }
      const filters = toolFiltersSchema.parse(args || {})
      const data = await analyticsService.getHrDashboard(user, filters)
      return { from: data.from, to: data.to, leaveByType: data.leaveByType }
    }
    case 'get_my_leave_balance': {
      if (user.role !== 'employee') {
        throw new AppError(403, 'This tool is available only to an employee for their own balance.')
      }
      return leaveService.getBalance(user)
    }
    case 'get_payroll_summary': {
      const filters = payrollArgumentsSchema.parse(args || {})
      if (user.role === 'employee') {
        const data = await analyticsService.getEmployeeDashboard(user)
        return { lastPayslip: data.lastPayslip }
      }
      if (user.role === 'admin') {
        let dashboardFilters = {}
        if (filters.from) {
          const [year, month] = filters.to.split('-').map(Number)
          const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
          dashboardFilters = {
            from: `${filters.from}-01`,
            to: `${filters.to}-${String(lastDay).padStart(2, '0')}`,
          }
        }
        const data = await analyticsService.getAdminDashboard(user, dashboardFilters)
        return data.payrollCost
      }
      const runs = await payrollService.listRuns()
      const selectedRuns = runs.filter((run) => (
        run.status === 'finalized' &&
        (!filters.from || (run.month >= filters.from && run.month <= filters.to))
      )).slice(0, 12)
      const summaries = await Promise.all(selectedRuns.map(async (run) => {
        const result = await payrollService.getRun(run.id)
        return {
          month: run.month,
          gross: result.items.reduce((total, item) => total + item.gross, 0),
          net: result.items.reduce((total, item) => total + item.netPay, 0),
        }
      }))
      return {
        finalizedMonths: summaries,
        gross: summaries.reduce((total, item) => total + item.gross, 0),
        net: summaries.reduce((total, item) => total + item.net, 0),
      }
    }
    case 'search_employees': {
      const { search, limit } = searchArgumentsSchema.parse(args || {})
      if (user.role === 'employee') {
        const ownEmployee = await employeeService.getMyEmployee(user)
        const matches = [ownEmployee].filter((employee) => (
          [employee.name, employee.code, employee.email]
            .some((field) => field?.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        ))
        return {
          employees: matches.slice(0, limit).map((employee) => ({
            id: employee.id,
            name: employee.name,
            code: employee.code,
            department: employee.department?.name || null,
            designation: employee.designation?.name || null,
            status: employee.status,
          })),
        }
      }
      requireCompanyRole(user)
      const result = await employeeService.listEmployees({
        search,
        page: 1,
        pageSize: limit,
      })
      return {
        employees: result.employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          code: employee.code,
          email: employee.email,
          department: employee.department?.name || null,
          designation: employee.designation?.name || null,
          status: employee.status,
        })),
      }
    }
    default:
      throw new AppError(400, 'The requested AI tool is not available.')
  }
}

const normalizeHistory = (history = []) => history.slice(-10).map((entry) => ({
  role: entry.role === 'assistant' ? 'model' : 'user',
  parts: [{ text: entry.content }],
}))

const runChatLoop = async (user, message, history, signal, usedTools) => {
  const client = getAiClient()
  const contents = [
    ...normalizeHistory(history),
    { role: 'user', parts: [{ text: message }] },
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: `${policyInstructions} The authenticated user role is ${user.role}. Enforce this role when deciding which tools and data are appropriate.`,
        tools: [{ functionDeclarations }],
        automaticFunctionCalling: { disable: true },
        abortSignal: signal,
      },
    })
    const calls = response.functionCalls || []
    if (!calls.length) return response.text?.trim() || null

    const modelContent = response.candidates?.[0]?.content
    if (modelContent) contents.push(modelContent)
    const functionResponses = []
    for (const call of calls) {
      if (!call.name) continue
      usedTools.add(call.name)
      let result
      try {
        result = await executeTool(call.name, call.args || {}, user)
      } catch (error) {
        if (error instanceof AppError && error.status === 403) {
          result = { error: 'This role is not allowed to access the requested data.' }
        } else if (error instanceof z.ZodError) {
          result = { error: 'The tool arguments were invalid. Use valid date filters and try again.' }
        } else {
          throw error
        }
      }
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: { result },
        },
      })
    }
    if (!functionResponses.length) return null
    contents.push({ role: 'user', parts: functionResponses })
  }
  return null
}

const looksLikeColleaguePrivateDataRequest = (message) => {
  const normalized = message.toLocaleLowerCase()
  const asksAboutPay = /\b(salary|payroll|payslip|gross pay|net pay|income|tankhwa|tankhwah|salary package)\b/i.test(normalized)
  if (!asksAboutPay) return false
  if (/\b(colleague|coworker|co-worker|another employee|other employee|someone else|my friend|team member|dusre|doosre|kisi aur|colleague ki|us ki|uski)\b/i.test(normalized)) {
    return true
  }
  const asksAboutNamedPerson = /\b[a-z][a-z'-]{1,30}\s+(?:ki|ka|ke|['’]s)\s+(?:salary|payroll|payslip|tankhwa|tankhwah)\b/i.test(normalized) ||
    /\b(?:salary|payroll|payslip|tankhwa|tankhwah)\s+(?:of|for)\s+[a-z][a-z'-]{1,30}\b/i.test(normalized)
  const asksAboutOwnPay = /\b(my|mine|meri|mera|mere|apni|apna|apne)\b/i.test(normalized)
  return asksAboutNamedPerson && !asksAboutOwnPay
}

const chat = async (user, data) => {
  if (
    user.role === 'employee' &&
    looksLikeColleaguePrivateDataRequest(data.message)
  ) {
    const text = 'I can only help with your own information and company policies, not a colleague’s salary or private details.'
    await executeAiCall(user, data.message, async () => text)
    return { reply: text, aiGenerated: true }
  }
  const result = await executeAiCall(
    user,
    data.message,
    (signal, usedTools) => runChatLoop(user, data.message, data.history, signal, usedTools),
  )
  return {
    reply: result || FALLBACK_MESSAGE,
    aiGenerated: true,
  }
}

const sanitizeDashboardKpis = (role, data) => {
  if (role === 'admin') {
    return {
      from: data.from,
      to: data.to,
      headcount: data.headcount,
      attrition: data.attrition,
      payrollCost: data.payrollCost,
      averageSalary: data.averageSalary,
      headcountByDepartment: data.headcountByDepartment,
      genderBreakdown: data.genderBreakdown,
      tenureBreakdown: data.tenureBreakdown,
    }
  }
  return {
    from: data.from,
    to: data.to,
    headcount: data.headcount,
    presentToday: data.presentToday,
    onLeaveToday: data.onLeaveToday,
    lateToday: data.lateToday,
    pendingApprovals: data.pendingApprovals,
    attendanceTrend: data.attendanceTrend,
    absenteeismByDepartment: data.absenteeismByDepartment,
    leaveByType: data.leaveByType,
  }
}

const collectNumbers = (value, numbers = new Set()) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    numbers.add(value)
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectNumbers(item, numbers))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectNumbers(item, numbers))
  }
  return numbers
}

const summaryUsesOnlySuppliedNumbers = (bullets, kpis) => {
  const allowed = collectNumbers(kpis)
  const spelledNumberPattern = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|half|double|twice|hundred|thousand|million|billion)\b/i
  return bullets.every((bullet) => {
    if (spelledNumberPattern.test(bullet)) return false
    const values = bullet.match(/\d[\d,]*(?:\.\d+)?/g) || []
    return values.every((value) => {
      const parsed = Number(value.replaceAll(',', ''))
      return allowed.has(parsed)
    })
  })
}

const generateDashboardSummary = async (user, filters) => {
  requireCompanyRole(user)
  const result = await executeAiCall(user, 'Dashboard KPI summary', async (signal) => {
    const dashboard = await getCompanyDashboard(user, filters)
    const kpis = sanitizeDashboardKpis(user.role, dashboard)
    const prompt = [
      'Summarize these HCM dashboard KPI values as 3 to 5 concise bullets.',
      'Use only facts and numeric values present in the JSON. Do not infer, calculate, compare, or invent numbers.',
      'Write numeric quantities as numerals exactly as represented in the JSON; do not spell out numbers or add dates.',
      `KPI JSON: ${JSON.stringify(kpis)}`,
    ].join('\n')
    const client = getAiClient()
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: `${policyInstructions} Summarize only the JSON numbers supplied in the user prompt; do not answer unrelated questions.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                bullets: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['bullets'],
            },
            abortSignal: signal,
          },
        })
        const parsed = summaryResultSchema.parse(JSON.parse(response.text || '{}'))
        if (!summaryUsesOnlySuppliedNumbers(parsed.bullets, kpis)) {
          throw new Error('The summary included numbers outside the supplied dashboard data.')
        }
        return parsed
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('Dashboard summary could not be validated.')
  })
  return {
    summary: result,
    message: result ? null : FALLBACK_MESSAGE,
    aiGenerated: true,
  }
}

const buildSmartLeavePrompt = ({ text, today, timezone, leaveTypes }) => [
  'Extract a leave request from the employee text. Do not submit or save it.',
  'Understand the request in English or Roman Urdu. Keep the reason in the employee language.',
  `Company-local today is ${today} in timezone ${timezone}. Resolve relative weekday phrases to the upcoming dates after today (for example, "next Monday" means the next Monday, not a past date).`,
  `Available leave types (type must exactly equal one id): ${JSON.stringify(leaveTypes)}`,
  'Return only JSON with keys type (leave type id), start (YYYY-MM-DD), end (YYYY-MM-DD), reason (short reason translated or preserved from the request). If type or dates are unclear, choose no invented data; return an invalid/empty value so validation can request a retry.',
  `Employee request: ${text}`,
].join('\n')

const smartLeave = async (user, text) => {
  if (user.role !== 'employee') {
    throw new AppError(403, 'Smart leave is available only to employees.')
  }
  const result = await executeAiCall(user, text, async (signal) => {
    const settings = await organizationSettingsService.getCompanySettings()
    const today = getLocalDate(new Date(), settings.timezone)
    const leaveTypes = await organizationSettingsService.listResource('leave-types')
    const prompt = buildSmartLeavePrompt({
      text,
      today,
      timezone: settings.timezone,
      leaveTypes: leaveTypes.map((type) => ({
        id: type.id,
        name: type.name,
        isUnlimited: type.isUnlimited,
        yearlyQuota: type.yearlyQuota,
        isPaid: type.isPaid,
      })),
    })
    const client = getAiClient()
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: 'Extract the requested leave fields only. Return valid JSON matching the requested object. Do not save or submit a leave request.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING' },
                start: { type: 'STRING' },
                end: { type: 'STRING' },
                reason: { type: 'STRING' },
              },
              required: ['type', 'start', 'end', 'reason'],
            },
            abortSignal: signal,
          },
        })
        const suggestion = smartLeaveResultSchema.parse(JSON.parse(response.text || '{}'))
        if (!leaveTypes.some((type) => type.id === suggestion.type)) {
          throw new Error('The suggested leave type is not configured.')
        }
        return suggestion
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('Smart leave response could not be validated.')
  })
  return {
    suggestion: result,
    message: result ? null : 'Could not understand that request. Please fill the leave form manually.',
    aiGenerated: true,
  }
}

module.exports = {
  chat,
  generateDashboardSummary,
  smartLeave,
  setAiClientForTesting,
}
