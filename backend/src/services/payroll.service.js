const mongoose = require('mongoose')
const PDFDocument = require('pdfkit')
const Attendance = require('../models/attendance.model')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const LeaveType = require('../models/leave-type.model')
const PayrollItem = require('../models/payroll-item.model')
const PayrollRun = require('../models/payroll-run.model')
const Notification = require('../models/notification.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const resolveEmployeeScope = require('../utils/employee-scope')
const { addDays, getLocalDate, getWeekday } = require('../utils/attendance-time')
const { logAction } = require('./audit.service')

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100

const getMonthBounds = (month) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

const getCompany = async (session) => {
  let query = Company.findById('primary')
  if (session) query = query.session(session)
  const company = await query.lean()
  if (!company) throw new AppError(404, 'Company setup has not been completed.')
  return {
    ...company,
    weekend: company.weekend || ['Sat', 'Sun'],
    timezone: company.timezone || 'Asia/Karachi',
  }
}

const getWorkingDates = (startDate, endDate, company, holidays) => {
  const dates = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (!company.weekend.includes(getWeekday(date)) && !holidays.has(date)) dates.push(date)
  }
  return dates
}

const calculateAnnualTax = (annualGross) => {
  if (annualGross <= 600000) return 0
  if (annualGross <= 1200000) return (annualGross - 600000) * 0.05
  if (annualGross <= 2400000) return 30000 + (annualGross - 1200000) * 0.15
  if (annualGross <= 3600000) return 210000 + (annualGross - 2400000) * 0.25
  return 510000 + (annualGross - 3600000) * 0.35
}

const serializeRun = (run) => ({
  id: run._id.toString(),
  month: run.month,
  status: run.status,
  createdBy: run.createdBy?.toString() || null,
  finalizedBy: run.finalizedBy?.toString() || null,
  finalizedAt: run.finalizedAt?.toISOString() || null,
  createdAt: run.createdAt.toISOString(),
})

const serializeItem = (item, runMonth, employee = item.employee) => ({
  id: item._id.toString(),
  runId: item.run?._id?.toString() || item.run?.toString(),
  month: runMonth,
  ...(employee && typeof employee === 'object' && employee.name
    ? {
        employee: {
          id: employee._id.toString(),
          code: employee.code,
          name: employee.name,
          department: employee.department?.name || null,
        },
      }
    : {}),
  basic: item.basic,
  hra: item.hra,
  medical: item.medical,
  gross: item.gross,
  workingDays: item.workingDays,
  absentDays: item.absentDays,
  unpaidLeaveDays: item.unpaidLeaveDays,
  halfDays: item.halfDays,
  deduction: item.deduction,
  annualTax: item.annualTax,
  monthlyTax: item.monthlyTax,
  netPay: item.netPay,
  daysPayable: item.daysPayable,
})

const buildItems = async ({ month, company, session }) => {
  const { startDate, endDate } = getMonthBounds(month)
  const today = getLocalDate(new Date(), company.timezone)
  const monthHolidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } })
    .select('date')
    .session(session)
    .lean()
  const holidays = new Set(monthHolidays.map((holiday) => holiday.date))
  const workingDates = getWorkingDates(startDate, endDate, company, holidays)
  if (workingDates.length === 0) {
    throw new AppError(422, 'The selected month has no company working days.')
  }

  const employees = await Employee.find({
    status: { $in: ['active', 'probation', 'exited'] },
    joinDate: { $lte: endDate },
    $or: [
      { status: { $in: ['active', 'probation'] } },
      { exitDate: { $gte: startDate } },
    ],
  }).session(session).lean()
  const employeeIds = employees.map(({ _id }) => _id)
  if (!employees.length) return []

  const attendanceRecords = await Attendance.find({
    employee: { $in: employeeIds },
    date: { $gte: startDate, $lte: endDate },
  }).session(session).select('employee date status').lean()
  const leaveRequests = await LeaveRequest.find({
    employee: { $in: employeeIds },
    status: 'approved',
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).session(session).populate('leaveType', 'isPaid').select('employee startDate endDate leaveType').lean()
  const attendanceByEmployeeDate = new Map(
    attendanceRecords.map((record) => [`${record.employee}:${record.date}`, record]),
  )
  const leaveByEmployeeDate = new Map()
  for (const leave of leaveRequests) {
    const first = leave.startDate < startDate ? startDate : leave.startDate
    const last = leave.endDate > endDate ? endDate : leave.endDate
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const key = `${leave.employee}:${date}`
      leaveByEmployeeDate.set(key, {
        unpaid: !leave.leaveType?.isPaid,
      })
    }
  }

  return employees.map((employee) => {
    const basicMonthly = employee.basicSalary
    const hraMonthly = basicMonthly * 0.4
    const medicalMonthly = basicMonthly * 0.1
    const grossMonthly = basicMonthly + hraMonthly + medicalMonthly
    const payableStart = employee.joinDate > startDate ? employee.joinDate : startDate
    const effectiveExit = employee.exitDate && employee.exitDate < endDate
      ? employee.exitDate
      : endDate
    const payableDates = payableStart <= effectiveExit
      ? getWorkingDates(payableStart, effectiveExit, company, holidays)
      : []
    let absentDays = 0
    let unpaidLeaveDays = 0
    let halfDays = 0

    for (const date of payableDates) {
      if (date > today) continue
      const key = `${employee._id}:${date}`
      const attendance = attendanceByEmployeeDate.get(key)
      const approvedLeave = leaveByEmployeeDate.get(key)
      if (attendance) {
        if (attendance.status === 'half_day') halfDays += 1
        if (attendance.status === 'absent') absentDays += 1
        continue
      }
      if (approvedLeave) {
        if (approvedLeave.unpaid) unpaidLeaveDays += 1
      } else {
        absentDays += 1
      }
    }

    const workingDays = workingDates.length
    const daysPayable = payableDates.length
    const dailyGross = grossMonthly / workingDays
    const deduction = roundMoney(
      (absentDays + unpaidLeaveDays + 0.5 * halfDays) * dailyGross,
    )
    const annualTax = roundMoney(calculateAnnualTax(grossMonthly * 12))
    const proration = daysPayable / workingDays
    const basic = roundMoney(basicMonthly * proration)
    const hra = roundMoney(hraMonthly * proration)
    const medical = roundMoney(medicalMonthly * proration)
    const gross = roundMoney(basic + hra + medical)
    const monthlyTax = roundMoney((annualTax / 12) * proration)
    const netPay = roundMoney(gross - deduction - monthlyTax)

    return {
      run: null,
      employee: employee._id,
      basic,
      hra,
      medical,
      gross,
      workingDays,
      absentDays,
      unpaidLeaveDays,
      halfDays,
      deduction,
      annualTax,
      monthlyTax,
      netPay,
      daysPayable,
    }
  })
}

const createOrRegenerateRun = async (user, month, regenerate = false) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AppError(400, 'Month must use YYYY-MM format.')
  }
  const session = await mongoose.startSession()
  const existingRun = await PayrollRun.findOne({ month }).lean()
  let runId
  let created = false
  try {
    await session.withTransaction(async () => {
      let run = await PayrollRun.findOne({ month }).session(session)
      if (run) {
        if (run.status === 'finalized') {
          throw new AppError(409, 'Finalized payroll runs are locked and cannot be regenerated.')
        }
        if (!regenerate) {
          throw new AppError(409, 'A payroll run already exists for this month. Set regenerate=true to rebuild the draft.')
        }
        run = await PayrollRun.findOneAndUpdate(
          { _id: run._id, status: 'draft' },
          { $set: { updatedAt: new Date() } },
          { returnDocument: 'after', session },
        )
        if (!run) {
          throw new AppError(409, 'The payroll run is no longer an editable draft.')
        }
        await PayrollItem.deleteMany({ run: run._id }, { session })
      } else {
        ;[run] = await PayrollRun.create([{
          month,
          status: 'draft',
          createdBy: user._id,
        }], { session })
        created = true
      }
      runId = run._id
      const company = await getCompany(session)
      const items = await buildItems({ month, company, session })
      if (items.length) {
        await PayrollItem.insertMany(
          items.map((item) => ({ ...item, run: runId })),
          { session },
        )
      }
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'A payroll run already exists for this month.')
    }
    throw error
  } finally {
    await session.endSession()
  }
  const run = await PayrollRun.findById(runId).lean()
  const items = await PayrollItem.find({ run: runId })
    .populate({ path: 'employee', select: 'name code department', populate: { path: 'department', select: 'name' } })
    .lean()
  const result = {
    created,
    run: serializeRun(run),
    items: items.map((item) => serializeItem(item, month, item.employee)),
  }
  await logAction({
    actor: user,
    action: created ? 'create' : 'regenerate',
    entityType: 'PayrollRun',
    entityId: result.run.id,
    before: existingRun,
    after: {
      run: result.run,
      itemCount: result.items.length,
      totalGross: roundMoney(result.items.reduce((sum, item) => sum + item.gross, 0)),
      totalNet: roundMoney(result.items.reduce((sum, item) => sum + item.netPay, 0)),
    },
  })
  return result
}

const listRuns = async () => {
  const runs = await PayrollRun.find().sort({ month: -1, _id: -1 }).lean()
  const itemCounts = await PayrollItem.aggregate([
    { $group: { _id: '$run', count: { $sum: 1 } } },
  ])
  const countsByRun = new Map(itemCounts.map(({ _id, count }) => [_id.toString(), count]))
  return runs.map((run) => ({
    ...serializeRun(run),
    itemCount: countsByRun.get(run._id.toString()) || 0,
  }))
}

const getRun = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Payroll run id is invalid.')
  const run = await PayrollRun.findById(id).lean()
  if (!run) throw new AppError(404, 'Payroll run was not found.')
  const items = await PayrollItem.find({ run: run._id })
    .populate({ path: 'employee', select: 'name code department', populate: { path: 'department', select: 'name' } })
    .sort({ 'employee.name': 1, _id: 1 })
    .lean()
  return {
    run: serializeRun(run),
    items: items.map((item) => serializeItem(item, run.month, item.employee)),
  }
}

const finalizeRun = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Payroll run id is invalid.')
  const before = await PayrollRun.findById(id).lean()
  if (!before) throw new AppError(404, 'Payroll run was not found.')
  const session = await mongoose.startSession()
  let run
  try {
    await session.withTransaction(async () => {
      run = await PayrollRun.findOneAndUpdate(
        { _id: id, status: 'draft' },
        {
          $set: {
            status: 'finalized',
            finalizedBy: user._id,
            finalizedAt: new Date(),
          },
        },
        { returnDocument: 'after', runValidators: true, session },
      ).lean()
      if (!run) throw new AppError(409, 'This payroll run has already been finalized.')

      const items = await PayrollItem.find({ run: id }).select('employee').session(session).lean()
      const employees = [...new Set(items.map((item) => item.employee.toString()))]
      const users = await User.find({
        role: 'employee',
        employeeId: { $in: employees },
      }).select('_id employeeId').session(session).lean()
      if (users.length) {
        await Notification.create(users.map((employeeUser) => ({
          user: employeeUser._id,
          title: 'Payslip available',
          message: `Your payslip for ${run.month} has been finalized and is ready to download.`,
        })), { session, ordered: true })
      }
    })
  } finally {
    await session.endSession()
  }
  if (!run) {
    const existing = await PayrollRun.findById(id).select('status').lean()
    if (!existing) throw new AppError(404, 'Payroll run was not found.')
    throw new AppError(409, 'This payroll run has already been finalized.')
  }
  const serialized = serializeRun(run)
  await logAction({
    actor: user,
    action: 'finalize',
    entityType: 'PayrollRun',
    entityId: id,
    before,
    after: serialized,
  })
  return serialized
}

const getMyPayslips = async (user) => {
  const employeeId = resolveEmployeeScope(user)
  const finalizedRuns = await PayrollRun.find({ status: 'finalized' }).select('_id month').lean()
  const monthByRun = new Map(finalizedRuns.map((run) => [run._id.toString(), run.month]))
  const items = await PayrollItem.find({
    employee: employeeId,
    run: { $in: finalizedRuns.map(({ _id }) => _id) },
  }).sort({ run: -1, _id: -1 }).lean()
  return items.map((item) => ({
    ...serializeItem(item, monthByRun.get(item.run.toString())),
    runId: item.run.toString(),
    status: 'finalized',
  }))
}

const getPayslipPdf = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Payslip id is invalid.')
  const item = await PayrollItem.findById(id)
    .populate({ path: 'employee', select: 'name code email department', populate: { path: 'department', select: 'name' } })
    .lean()
  if (!item) throw new AppError(404, 'Payslip was not found.')
  if (user.role === 'employee' && item.employee._id.toString() !== user.employeeId) {
    throw new AppError(403, 'You are not allowed to access another employee payslip.')
  }
  const run = await PayrollRun.findById(item.run).lean()
  if (!run) throw new AppError(404, 'Payroll run was not found.')
  if (user.role === 'employee' && run.status !== 'finalized') {
    throw new AppError(403, 'Payslips are available after payroll is finalized.')
  }
  const company = await getCompany()

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks = []
    document.on('data', (chunk) => chunks.push(chunk))
    document.on('error', reject)
    document.on('end', () => resolve({
      filename: `payslip-${run.month}-${item.employee.code}.pdf`,
      buffer: Buffer.concat(chunks),
    }))

    document.fontSize(20).text(company.name, { align: 'center' })
    document.moveDown(0.4).fontSize(15).text('Payslip', { align: 'center' })
    document.moveDown().fontSize(11)
    document.text(`Employee: ${item.employee.name} (${item.employee.code})`)
    document.text(`Email: ${item.employee.email}`)
    document.text(`Department: ${item.employee.department?.name || '—'}`)
    document.text(`Payroll month: ${run.month}`)
    document.text(`Days payable: ${item.daysPayable} / ${item.workingDays}`)
    document.moveDown()
    document.fontSize(13).text('Earnings', { underline: true })
    document.fontSize(11)
    document.text(`Basic salary: ${item.basic.toFixed(2)}`)
    document.text(`HRA: ${item.hra.toFixed(2)}`)
    document.text(`Medical: ${item.medical.toFixed(2)}`)
    document.text(`Gross pay: ${item.gross.toFixed(2)}`)
    document.moveDown().fontSize(13).text('Deductions', { underline: true })
    document.fontSize(11)
    document.text(`Absent days: ${item.absentDays}`)
    document.text(`Unpaid leave days: ${item.unpaidLeaveDays}`)
    document.text(`Half days: ${item.halfDays}`)
    document.text(`Attendance and leave deduction: ${item.deduction.toFixed(2)}`)
    document.text(`Annual tax: ${item.annualTax.toFixed(2)}`)
    document.text(`Monthly tax (prorated): ${item.monthlyTax.toFixed(2)}`)
    document.moveDown().font('Helvetica-Bold').fontSize(15).text(`Net pay: ${item.netPay.toFixed(2)}`)
    document.end()
  })
}

module.exports = {
  calculateAnnualTax,
  createOrRegenerateRun,
  listRuns,
  getRun,
  finalizeRun,
  getMyPayslips,
  getPayslipPdf,
}
