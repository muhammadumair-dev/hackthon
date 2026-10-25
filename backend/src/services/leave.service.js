const mongoose = require('mongoose')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const LeaveType = require('../models/leave-type.model')
const Notification = require('../models/notification.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const resolveEmployeeScope = require('../utils/employee-scope')
const { addDays, getWeekday, isIsoDate } = require('../utils/attendance-time')
const { logAction } = require('./audit.service')

const getCompany = async () => {
  const company = await Company.findById('primary').lean()
  if (!company) throw new AppError(404, 'Company setup has not been completed.')
  return {
    ...company,
    weekend: company.weekend || ['Sat', 'Sun'],
    timezone: company.timezone || 'Asia/Karachi',
  }
}

const getEmployeeForUser = async (user) => {
  const employeeId = resolveEmployeeScope(user)
  const employee = await Employee.findById(employeeId).lean()
  if (!employee) throw new AppError(404, 'Employee profile was not found.')
  if (!['active', 'probation'].includes(employee.status)) {
    throw new AppError(403, 'Leave requests are unavailable for an inactive employee.')
  }
  return employee
}

const getWorkingDates = (startDate, endDate, company, holidays) => {
  const dates = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (!company.weekend.includes(getWeekday(date)) && !holidays.has(date)) {
      dates.push(date)
    }
  }
  return dates
}

const getHolidays = async (startDate, endDate) => {
  const records = await Holiday.find({ date: { $gte: startDate, $lte: endDate } })
    .select('date')
    .lean()
  return new Set(records.map(({ date }) => date))
}

const validateRange = (startDate, endDate) => {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new AppError(400, 'Dates must be valid YYYY-MM-DD values.')
  }
  if (startDate > endDate) {
    throw new AppError(422, 'The start date must be on or before the end date.')
  }
}

const serializeLeave = (leave) => ({
  id: leave._id.toString(),
  employeeId: leave.employee?._id
    ? leave.employee._id.toString()
    : leave.employee?.toString(),
  ...(leave.employee?.name
    ? {
        employee: {
          id: leave.employee._id.toString(),
          name: leave.employee.name,
          code: leave.employee.code,
          department: leave.employee.department
            ? {
                id: leave.employee.department._id.toString(),
                name: leave.employee.department.name,
              }
            : null,
        },
      }
    : {}),
  leaveType: leave.leaveType?._id
    ? {
        id: leave.leaveType._id.toString(),
        name: leave.leaveType.name,
        isUnlimited: leave.leaveType.isUnlimited,
        isPaid: leave.leaveType.isPaid,
      }
    : leave.leaveType?.toString(),
  startDate: leave.startDate,
  endDate: leave.endDate,
  days: leave.days,
  reason: leave.reason,
  status: leave.status,
  reviewedBy: leave.reviewedBy?.toString() || null,
  reviewedAt: leave.reviewedAt?.toISOString() || null,
  reviewComment: leave.reviewComment || null,
  createdAt: leave.createdAt.toISOString(),
})

const getUsageForYear = async (
  employeeId,
  leaveTypeId,
  year,
  company,
  holidays,
  session,
  excludeId,
) => {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const filter = {
    employee: employeeId,
    leaveType: leaveTypeId,
    status: 'approved',
    startDate: { $lte: yearEnd },
    endDate: { $gte: yearStart },
  }
  if (excludeId) filter._id = { $ne: excludeId }
  let query = LeaveRequest.find(filter).select('startDate endDate').lean()
  if (session) query = query.session(session)
  const requests = await query

  return requests.reduce((total, request) => {
    const startDate = request.startDate < yearStart ? yearStart : request.startDate
    const endDate = request.endDate > yearEnd ? yearEnd : request.endDate
    return total + getWorkingDates(startDate, endDate, company, holidays).length
  }, 0)
}

const getBalance = async (user) => {
  const employee = await getEmployeeForUser(user)
  const company = await getCompany()
  const year = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: company.timezone,
    year: 'numeric',
  }).format(new Date()))
  const leaveTypes = await LeaveType.find().sort({ name: 1, _id: 1 }).lean()
  const holidays = await getHolidays(`${year}-01-01`, `${year}-12-31`)
  const balances = await Promise.all(leaveTypes.map(async (leaveType) => {
    const used = await getUsageForYear(
      employee._id,
      leaveType._id,
      year,
      company,
      holidays,
    )
    return {
      id: leaveType._id.toString(),
      name: leaveType.name,
      yearlyQuota: leaveType.isUnlimited ? null : leaveType.yearlyQuota,
      isUnlimited: leaveType.isUnlimited,
      isPaid: leaveType.isPaid,
      used,
      remaining: leaveType.isUnlimited ? null : Math.max(0, leaveType.yearlyQuota - used),
    }
  }))
  return { year, leaveTypes: balances }
}

const assertNoOverlap = async (employeeId, startDate, endDate, excludeId, session) => {
  const filter = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }
  if (excludeId) filter._id = { $ne: excludeId }
  let query = LeaveRequest.findOne(filter).select('_id').lean()
  if (session) query = query.session(session)
  if (await query) throw new AppError(422, 'This leave overlaps a pending or approved request.')
}

const assertWithinBalance = async ({
  employeeId,
  leaveType,
  workingDates,
  company,
  excludeId,
  session,
}) => {
  if (leaveType.isUnlimited) return

  const datesByYear = new Map()
  for (const date of workingDates) {
    const year = Number(date.slice(0, 4))
    datesByYear.set(year, (datesByYear.get(year) || 0) + 1)
  }
  for (const [year, requestedDays] of datesByYear) {
    const holidays = await getHolidays(`${year}-01-01`, `${year}-12-31`)
    const used = await getUsageForYear(
      employeeId,
      leaveType._id,
      year,
      company,
      holidays,
      session,
      excludeId,
    )
    if (used + requestedDays > leaveType.yearlyQuota) {
      throw new AppError(422, `This request exceeds the ${leaveType.name} balance for ${year}.`)
    }
  }
}

const getWorkdays = async (startDate, endDate) => {
  validateRange(startDate, endDate)
  const company = await getCompany()
  const holidays = await getHolidays(startDate, endDate)
  const workingDates = getWorkingDates(startDate, endDate, company, holidays)
  return { startDate, endDate, days: workingDates.length, workingDates }
}

const createLeave = async (user, data) => {
  const employee = await getEmployeeForUser(user)
  validateRange(data.startDate, data.endDate)
  const company = await getCompany()
  const holidays = await getHolidays(data.startDate, data.endDate)
  const workingDates = getWorkingDates(data.startDate, data.endDate, company, holidays)
  if (!workingDates.length) {
    throw new AppError(422, 'The selected range contains no working days.')
  }
  const leaveType = await LeaveType.findById(data.leaveType).lean()
  if (!leaveType) throw new AppError(404, 'Leave type was not found.')

  await assertNoOverlap(employee._id, data.startDate, data.endDate)
  await assertWithinBalance({
    employeeId: employee._id,
    leaveType,
    workingDates,
    company,
  })

  const [leave] = await LeaveRequest.create([{
    employee: employee._id,
    leaveType: leaveType._id,
    startDate: data.startDate,
    endDate: data.endDate,
    days: workingDates.length,
    reason: data.reason,
    status: 'pending',
  }])
  const populated = await LeaveRequest.findById(leave._id)
    .populate('leaveType', 'name isUnlimited isPaid')
    .lean()
  return serializeLeave(populated)
}

const getMyLeaves = async (user) => {
  const employee = await getEmployeeForUser(user)
  const leaves = await LeaveRequest.find({ employee: employee._id })
    .populate('leaveType', 'name isUnlimited isPaid')
    .sort({ startDate: -1, _id: -1 })
    .lean()
  return leaves.map(serializeLeave)
}

const cancelLeave = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Leave request id is invalid.')
  const employee = await getEmployeeForUser(user)
  const leave = await LeaveRequest.findOneAndUpdate(
    { _id: id, employee: employee._id, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('leaveType', 'name isUnlimited isPaid')
    .lean()
  if (!leave) {
    const existing = await LeaveRequest.findById(id).select('employee status').lean()
    if (!existing) throw new AppError(404, 'Leave request was not found.')
    if (existing.employee.toString() !== employee._id.toString()) {
      throw new AppError(403, 'You are not allowed to cancel another employee request.')
    }
    throw new AppError(409, 'Only pending leave requests can be cancelled.')
  }
  const serialized = serializeLeave(leave)
  await logAction({
    actor: user,
    action: 'cancel',
    entityType: 'LeaveRequest',
    entityId: leave._id,
    before: { status: 'pending' },
    after: serialized,
  })
  return serialized
}

const listRequests = async ({ status = 'pending', department, page = 1, pageSize = 10 }) => {
  const filter = {}
  if (status && status !== 'all') filter.status = status
  if (department) {
    if (!mongoose.isValidObjectId(department)) throw new AppError(400, 'Department filter is invalid.')
    const employees = await Employee.find({ department }).select('_id').lean()
    filter.employee = { $in: employees.map(({ _id }) => _id) }
  }
  const [leaves, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate({ path: 'employee', select: 'name code department', populate: { path: 'department', select: 'name' } })
      .populate('leaveType', 'name isUnlimited isPaid')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    LeaveRequest.countDocuments(filter),
  ])
  return {
    leaves: leaves.map(serializeLeave),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

const reviewLeave = async (id, user, decision, comment) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Leave request id is invalid.')
  const company = await getCompany()
  const before = await LeaveRequest.findById(id).lean()
  if (!before) throw new AppError(404, 'Leave request was not found.')
  const session = await mongoose.startSession()
  let result
  try {
    await session.withTransaction(async () => {
      const leave = await LeaveRequest.findById(id).session(session).lean()
      if (!leave) throw new AppError(404, 'Leave request was not found.')
      if (leave.status !== 'pending') {
        throw new AppError(409, 'This leave request has already been reviewed.')
      }

      if (decision === 'approved') {
        const holidays = await getHolidays(leave.startDate, leave.endDate)
        const workingDates = getWorkingDates(leave.startDate, leave.endDate, company, holidays)
        if (workingDates.length === 0) {
          throw new AppError(422, 'The selected range contains no working days.')
        }
        const leaveType = await LeaveType.findById(leave.leaveType).session(session).lean()
        if (!leaveType) throw new AppError(404, 'Leave type was not found.')
        await assertNoOverlap(leave.employee, leave.startDate, leave.endDate, leave._id, session)
        await assertWithinBalance({
          employeeId: leave.employee,
          leaveType,
          workingDates,
          company,
          excludeId: leave._id,
          session,
        })
      }

      const reviewedAt = new Date()
      const updated = await LeaveRequest.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: decision,
            reviewedBy: user._id,
            reviewedAt,
            reviewComment: comment,
          },
        },
        { returnDocument: 'after', runValidators: true, session },
      ).lean()
      if (!updated) throw new AppError(409, 'This leave request has already been reviewed.')

      const employeeUser = await User.findOne({
        employeeId: leave.employee.toString(),
        role: 'employee',
      }).select('_id').session(session).lean()
      if (!employeeUser) throw new AppError(404, 'Employee login was not found.')
      const leaveType = await LeaveType.findById(leave.leaveType).select('name').session(session).lean()
      const outcome = decision === 'approved' ? 'approved' : 'rejected'
      await Notification.create([{
        user: employeeUser._id,
        title: `Leave request ${outcome}`,
        message: `Your ${leaveType?.name || 'leave'} request for ${leave.startDate} to ${leave.endDate} was ${outcome}.${comment ? ` Comment: ${comment}` : ''}`,
      }], { session })
      result = updated
    })
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'This leave request conflicts with another request.')
    throw error
  } finally {
    await session.endSession()
  }

  const populated = await LeaveRequest.findById(result._id)
    .populate('leaveType', 'name isUnlimited isPaid')
    .lean()
  const serialized = serializeLeave(populated)
  await logAction({
    actor: user,
    action: `leave-${decision}`,
    entityType: 'LeaveRequest',
    entityId: result._id,
    before: { status: before.status, reviewComment: before.reviewComment },
    after: serialized,
  })
  return serialized
}

module.exports = {
  getBalance,
  getWorkdays,
  createLeave,
  getMyLeaves,
  cancelLeave,
  listRequests,
  reviewLeave,
}
