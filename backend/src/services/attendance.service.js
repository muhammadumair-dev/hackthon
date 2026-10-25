const mongoose = require('mongoose')
const Attendance = require('../models/attendance.model')
const AttendanceCorrection = require('../models/attendance-correction.model')
const Company = require('../models/company.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const AppError = require('../utils/app-error')
const resolveEmployeeScope = require('../utils/employee-scope')
const { logAction } = require('./audit.service')
const {
  addDays,
  getLocalDate,
  getLocalMinutes,
  getLocalTime,
  getMinutes,
  getMonthDates,
  getWeekday,
  isIsoDate,
  roundHours,
  zonedDateTimeToUtc,
} = require('../utils/attendance-time')

const getCompany = async () => {
  const company = await Company.findById('primary').lean()
  if (!company) throw new AppError(404, 'Company setup has not been completed.')
  return {
    officeStart: '09:00',
    graceMinutes: 15,
    halfDayHours: 5,
    weekend: ['Sat', 'Sun'],
    timezone: 'Asia/Karachi',
    ...company,
    timezone: company.timezone || 'Asia/Karachi',
  }
}

const isEmployedOn = (employee, date) => (
  employee.joinDate <= date &&
  (employee.status !== 'exited' || !employee.exitDate || employee.exitDate >= date)
)

const isWorkingDay = (date, company, holidays) => (
  !company.weekend.includes(getWeekday(date)) && !holidays.has(date)
)

const getApprovedLeaveMap = async (employeeIds, startDate, endDate) => {
  const leavesByEmployeeAndDate = new Map()
  if (employeeIds.length === 0) return leavesByEmployeeAndDate
  const leaves = await LeaveRequest.find({
    employee: { $in: employeeIds },
    status: 'approved',
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).select('employee startDate endDate').lean()

  for (const leave of leaves) {
    const employeeId = leave.employee.toString()
    const from = leave.startDate < startDate ? startDate : leave.startDate
    const through = leave.endDate > endDate ? endDate : leave.endDate
    for (let date = from; date <= through; date = addDays(date, 1)) {
      leavesByEmployeeAndDate.set(`${employeeId}:${date}`, true)
    }
  }

  return leavesByEmployeeAndDate
}

const serializeAttendance = (
  attendance,
  timezone,
  status = attendance.status,
  includeId = true,
) => ({
  ...(includeId ? { id: attendance._id.toString() } : {}),
  date: attendance.date,
  checkIn: attendance.checkIn?.toISOString() || null,
  checkInTime: attendance.checkIn ? getLocalTime(attendance.checkIn, timezone) : null,
  checkOut: attendance.checkOut?.toISOString() || null,
  checkOutTime: attendance.checkOut ? getLocalTime(attendance.checkOut, timezone) : null,
  status,
  workedHours: attendance.workedHours || 0,
  note: attendance.note || null,
})

const getDayResult = ({ date, employee, attendance, company, holidays, approvedLeaves, today }) => {
  const base = {
    date,
    status: null,
    checkIn: null,
    checkInTime: null,
    checkOut: null,
    checkOutTime: null,
    workedHours: 0,
    note: null,
  }
  if (!isEmployedOn(employee, date)) {
    return { ...base, note: 'Employee was not employed on this date.' }
  }
  if (attendance) {
    return {
      ...base,
      ...serializeAttendance(
        attendance,
        company.timezone,
        attendance.checkOut ? attendance.status : 'missing_checkout',
        false,
      ),
    }
  }
  if (approvedLeaves.has(`${employee._id.toString()}:${date}`)) {
    return { ...base, status: 'on_leave', note: 'Approved leave.' }
  }
  if (!isWorkingDay(date, company, holidays)) {
    return {
      ...base,
      note: holidays.has(date) ? 'Company holiday.' : 'Weekend.',
    }
  }
  if (date > today) {
    return base
  }
  return { ...base, status: 'absent' }
}

const getEmployeeForUser = async (user) => {
  const employeeId = resolveEmployeeScope(user)
  const employee = await Employee.findById(employeeId).lean()
  if (!employee) throw new AppError(404, 'Employee profile was not found.')
  if (!['active', 'probation'].includes(employee.status)) {
    throw new AppError(403, 'Attendance is unavailable for an inactive employee.')
  }
  return employee
}

const checkIn = async (user) => {
  const employee = await getEmployeeForUser(user)
  const company = await getCompany()
  const now = new Date()
  const date = getLocalDate(now, company.timezone)
  const existing = await Attendance.findOne({ employee: employee._id, date }).lean()
  if (existing) throw new AppError(409, 'You have already checked in today.')

  const [holiday] = await Holiday.find({ date }).select('date name').lean()
  const cutoff = getMinutes(company.officeStart) + company.graceMinutes
  const status = getLocalMinutes(now, company.timezone) > cutoff ? 'late' : 'present'
  const notes = []
  const weekday = getWeekday(date)
  if (company.weekend.includes(weekday)) notes.push('Weekend check-in.')
  if (holiday) notes.push(`Company holiday: ${holiday.name}.`)

  try {
    const [attendance] = await Attendance.create([{
      employee: employee._id,
      date,
      checkIn: now,
      checkOut: null,
      status,
      workedHours: 0,
      source: 'web',
      note: notes.length ? notes.join(' ') : null,
    }])
    return {
      timezone: company.timezone,
      attendance: serializeAttendance(attendance, company.timezone),
    }
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'You have already checked in today.')
    }
    throw error
  }
}

const checkOut = async (user) => {
  const employee = await getEmployeeForUser(user)
  const company = await getCompany()
  const now = new Date()
  const date = getLocalDate(now, company.timezone)
  const attendance = await Attendance.findOne({ employee: employee._id, date })
  if (!attendance) throw new AppError(409, 'Check in before checking out.')
  if (attendance.checkOut) throw new AppError(409, 'You have already checked out today.')
  if (now <= attendance.checkIn) {
    throw new AppError(409, 'Check-out time must be later than check-in time.')
  }

  const workedHours = roundHours(now.getTime() - attendance.checkIn.getTime())
  const status = workedHours < company.halfDayHours ? 'half_day' : attendance.status
  const checkedOutAttendance = await Attendance.findOneAndUpdate(
    { _id: attendance._id, checkOut: null },
    { $set: { checkOut: now, workedHours, status } },
    { returnDocument: 'after', runValidators: true },
  )
  if (!checkedOutAttendance) {
    throw new AppError(409, 'You have already checked out today.')
  }

  return {
    timezone: company.timezone,
    attendance: serializeAttendance(checkedOutAttendance, company.timezone),
  }
}

const getMyAttendance = async (user, month) => {
  const employee = await getEmployeeForUser(user)
  const company = await getCompany()
  const dates = getMonthDates(month)
  const today = getLocalDate(new Date(), company.timezone)
  const [records, holidayRecords, approvedLeaves, todayRecord, todayHoliday, todayLeaves] = await Promise.all([
    Attendance.find({
      employee: employee._id,
      date: { $gte: dates[0], $lte: dates[dates.length - 1] },
    }).lean(),
    Holiday.find({ date: { $gte: dates[0], $lte: dates[dates.length - 1] } }).select('date').lean(),
    getApprovedLeaveMap([employee._id.toString()], dates[0], dates[dates.length - 1]),
    today >= dates[0] && today <= dates[dates.length - 1]
      ? Promise.resolve(null)
      : Attendance.findOne({ employee: employee._id, date: today }).lean(),
    today >= dates[0] && today <= dates[dates.length - 1]
      ? Promise.resolve(null)
      : Holiday.findOne({ date: today }).select('date').lean(),
    today >= dates[0] && today <= dates[dates.length - 1]
      ? Promise.resolve(null)
      : getApprovedLeaveMap([employee._id.toString()], today, today),
  ])
  const attendanceByDate = new Map(records.map((record) => [record.date, record]))
  const holidays = new Set(holidayRecords.map((holiday) => holiday.date))
  const todayAttendance = todayRecord || attendanceByDate.get(today)
  const todayHolidayRecord = todayHoliday || holidayRecords.find((holiday) => holiday.date === today)
  const todayApprovedLeaves = todayLeaves || approvedLeaves
  const todayHolidays = todayHolidayRecord ? new Set([today]) : holidays

  return {
    month,
    timezone: company.timezone,
    today: getDayResult({
      date: today,
      employee,
      attendance: todayAttendance,
      company,
      holidays: todayHolidays,
      approvedLeaves: todayApprovedLeaves,
      today,
    }),
    days: dates.map((date) => getDayResult({
      date,
      employee,
      attendance: attendanceByDate.get(date),
      company,
      holidays,
      approvedLeaves,
      today,
    })),
  }
}

const getAttendanceBoard = async ({ date, department }) => {
  const company = await getCompany()
  const employeeFilter = { status: { $in: ['active', 'probation'] } }
  if (department) {
    if (!mongoose.isValidObjectId(department)) throw new AppError(400, 'Department filter is invalid.')
    employeeFilter.department = department
  }

  const employees = await Employee.find(employeeFilter)
    .populate('department', 'name')
    .sort({ name: 1, _id: 1 })
    .lean()
  const employeeIds = employees.map((employee) => employee._id)
  const [records, holidayRecords, approvedLeaves] = await Promise.all([
    Attendance.find({ employee: { $in: employeeIds }, date }).lean(),
    Holiday.find({ date }).select('date').lean(),
    getApprovedLeaveMap(employeeIds.map(String), date, date),
  ])
  const today = getLocalDate(new Date(), company.timezone)
  const attendanceByEmployee = new Map(records.map((record) => [record.employee.toString(), record]))
  const holidays = new Set(holidayRecords.map((holiday) => holiday.date))

  return {
    date,
    timezone: company.timezone,
    employees: employees.map((employee) => {
      const result = getDayResult({
        date,
        employee,
        attendance: attendanceByEmployee.get(employee._id.toString()),
        company,
        holidays,
        approvedLeaves,
        today,
      })
      return {
        employeeId: employee._id.toString(),
        code: employee.code,
        name: employee.name,
        department: {
          id: employee.department?._id?.toString() || '',
          name: employee.department?.name || '',
        },
        status: result.status,
        checkInTime: result.checkInTime,
        checkOutTime: result.checkOutTime,
        workedHours: result.workedHours,
        note: result.note,
      }
    }),
  }
}

const serializeCorrection = (correction, employee = correction.employee) => ({
  id: correction._id.toString(),
  employeeId: (employee?._id || correction.employee).toString(),
  employee: employee && typeof employee === 'object' && employee.name
    ? { name: employee.name, code: employee.code }
    : undefined,
  date: correction.date,
  requestedCheckIn: correction.requestedCheckIn,
  requestedCheckOut: correction.requestedCheckOut,
  reason: correction.reason,
  status: correction.status,
  comment: correction.comment || null,
  createdAt: correction.createdAt.toISOString(),
})

const requestCorrection = async (user, data) => {
  const employee = await getEmployeeForUser(user)
  const company = await getCompany()
  const today = getLocalDate(new Date(), company.timezone)
  if (data.date > today) throw new AppError(400, 'Correction date cannot be in the future.')
  const requestedIn = zonedDateTimeToUtc(data.date, data.requestedCheckIn, company.timezone)
  const requestedOut = zonedDateTimeToUtc(data.date, data.requestedCheckOut, company.timezone)
  if (requestedOut <= requestedIn) {
    throw new AppError(400, 'Requested check-out must be later than requested check-in.')
  }

  try {
    const [correction] = await AttendanceCorrection.create([{
      employee: employee._id,
      ...data,
      status: 'pending',
    }])
    return serializeCorrection(correction)
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'A pending correction already exists for this date.')
    }
    throw error
  }
}

const listCorrections = async (user) => {
  const filter = user.role === 'employee'
    ? { employee: resolveEmployeeScope(user) }
    : user.role === 'hr'
      ? { status: 'pending' }
      : {}
  const corrections = await AttendanceCorrection.find(filter)
    .populate('employee', 'name code')
    .sort({ createdAt: 1, _id: 1 })
    .lean()
  return corrections.map((correction) => serializeCorrection(correction))
}

const reviewCorrection = async (id, user, decision, comment) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Correction id is invalid.')
  const company = await getCompany()
  const before = await AttendanceCorrection.findById(id).lean()
  if (!before) throw new AppError(404, 'Attendance correction was not found.')
  const session = await mongoose.startSession()
  let updated
  try {
    await session.withTransaction(async () => {
      const correction = await AttendanceCorrection.findById(id).session(session).lean()
      if (!correction) throw new AppError(404, 'Attendance correction was not found.')
      if (correction.status !== 'pending') {
        throw new AppError(409, 'This correction has already been reviewed.')
      }

      if (decision === 'approved') {
        const checkIn = zonedDateTimeToUtc(
          correction.date,
          correction.requestedCheckIn,
          company.timezone,
        )
        const checkOut = zonedDateTimeToUtc(
          correction.date,
          correction.requestedCheckOut,
          company.timezone,
        )
        if (checkOut <= checkIn) {
          throw new AppError(409, 'Requested check-out must be later than requested check-in.')
        }

        const workedHours = roundHours(checkOut.getTime() - checkIn.getTime())
        const lateThreshold = getMinutes(company.officeStart) + company.graceMinutes
        let status = getMinutes(correction.requestedCheckIn) > lateThreshold ? 'late' : 'present'
        if (workedHours < company.halfDayHours) status = 'half_day'

        await Attendance.findOneAndUpdate(
          { employee: correction.employee, date: correction.date },
          {
            $set: {
              employee: correction.employee,
              date: correction.date,
              checkIn,
              checkOut,
              status,
              workedHours,
              source: 'web',
              note: null,
            },
          },
          { upsert: true, runValidators: true, returnDocument: 'after', session },
        )
      }

      updated = await AttendanceCorrection.findByIdAndUpdate(
        id,
        {
          $set: {
            status: decision,
            comment,
            reviewedBy: user._id,
            reviewedAt: new Date(),
          },
        },
        { returnDocument: 'after', runValidators: true, session },
      ).lean()
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'Attendance record already exists for this date.')
    }
    throw error
  } finally {
    await session.endSession()
  }

  const employee = await Employee.findById(updated.employee).select('name code').lean()
  const serialized = serializeCorrection(updated, employee)
  await logAction({
    actor: user,
    action: `correction-${decision}`,
    entityType: 'AttendanceCorrection',
    entityId: updated._id,
    before: {
      date: before.date,
      requestedCheckIn: before.requestedCheckIn,
      requestedCheckOut: before.requestedCheckOut,
      reason: before.reason,
      status: before.status,
    },
    after: serialized,
  })
  return serialized
}

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendanceBoard,
  requestCorrection,
  listCorrections,
  reviewCorrection,
}
