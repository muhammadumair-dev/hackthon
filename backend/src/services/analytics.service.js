const mongoose = require('mongoose')
const Attendance = require('../models/attendance.model')
const AttendanceCorrection = require('../models/attendance-correction.model')
const Announcement = require('../models/announcement.model')
const AuditLog = require('../models/audit-log.model')
const Company = require('../models/company.model')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Employee = require('../models/employee.model')
const Holiday = require('../models/holiday.model')
const LeaveRequest = require('../models/leave-request.model')
const LeaveType = require('../models/leave-type.model')
const PayrollItem = require('../models/payroll-item.model')
const PayrollRun = require('../models/payroll-run.model')
const AppError = require('../utils/app-error')
const resolveEmployeeScope = require('../utils/employee-scope')
const {
  addDays,
  getLocalDate,
  getMinutes,
  getWeekday,
  isIsoDate,
} = require('../utils/attendance-time')

const getCompany = async () => {
  const company = await Company.findById('primary').lean()
  if (!company) throw new AppError(404, 'Company setup has not been completed.')
  return {
    ...company,
    weekend: company.weekend || ['Sat', 'Sun'],
    timezone: company.timezone || 'Asia/Karachi',
  }
}

const designationNameMap = async (designationIds) => {
  const unique = [...new Set(designationIds.filter(Boolean).map(String))]
  if (!unique.length) return new Map()
  const records = await Designation.aggregate([
    { $match: { _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $project: { _id: 1, name: 1 } },
  ])
  return new Map(records.map((designation) => [designation._id.toString(), designation.name]))
}

const getDefaultRange = (company) => {
  const to = getLocalDate(new Date(), company.timezone)
  return {
    from: `${to.slice(0, 7)}-01`,
    to,
  }
}

const validateFilters = async (filters = {}, getDefaultRangeForDashboard = getDefaultRange) => {
  const company = await getCompany()
  const defaults = getDefaultRangeForDashboard(company)
  const from = filters.from || defaults.from
  const to = filters.to || defaults.to
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw new AppError(400, 'Choose a valid date range with from on or before to.')
  }
  const start = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  const rangeDays = Math.floor((end - start) / 86400000) + 1
  if (rangeDays > 366) throw new AppError(400, 'Date range cannot exceed 366 days.')
  let departmentId = null
  if (filters.department) {
    if (!mongoose.isValidObjectId(filters.department)) {
      throw new AppError(400, 'Department filter is invalid.')
    }
    departmentId = new mongoose.Types.ObjectId(filters.department)
  }
  return { company, from, to, departmentId }
}

const assertRole = (user, roles) => {
  if (!user || !roles.includes(user.role)) {
    throw new AppError(403, 'You are not allowed to access these analytics.')
  }
}

const isWorkingDate = (date, company, holidays) => (
  !company.weekend.includes(getWeekday(date)) && !holidays.has(date)
)

const getWorkingDates = (from, to, company, holidays) => {
  const dates = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (isWorkingDate(date, company, holidays)) dates.push(date)
  }
  return dates
}

const getHolidaySet = async (from, to) => {
  const records = await Holiday.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $project: { _id: 0, date: 1 } },
  ])
  return new Set(records.map(({ date }) => date))
}

const employeePeriodPipeline = (from, to, departmentId, asOf = to) => {
  const match = {
    joinDate: { $lte: asOf },
    $or: [
      { status: { $in: ['active', 'probation'] } },
      { status: 'exited', exitDate: { $gte: from } },
    ],
  }
  if (departmentId) match.department = departmentId
  return [
    { $match: match },
    {
      $project: {
        name: 1,
        code: 1,
        email: 1,
        department: 1,
        designation: 1,
        gender: 1,
        joinDate: 1,
        exitDate: 1,
        status: 1,
        basicSalary: 1,
      },
    },
  ]
}

const employeeSnapshotPipeline = (date, departmentId) => {
  const match = {
    joinDate: { $lte: date },
    $or: [
      { status: { $in: ['active', 'probation'] } },
      { status: 'exited', exitDate: { $gte: date } },
    ],
  }
  if (departmentId) match.department = departmentId
  return [
    { $match: match },
    {
      $project: {
        name: 1,
        code: 1,
        department: 1,
        designation: 1,
        gender: 1,
        joinDate: 1,
        exitDate: 1,
        status: 1,
        basicSalary: 1,
      },
    },
  ]
}

const isEmployedOn = (employee, date) => (
  employee.joinDate <= date &&
  (employee.status !== 'exited' || !employee.exitDate || employee.exitDate >= date)
)

const departmentNameMap = async (departmentIds) => {
  const unique = [...new Set(departmentIds.filter(Boolean).map(String))]
  if (!unique.length) return new Map()
  const records = await Department.aggregate([
    { $match: { _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $project: { _id: 1, name: 1 } },
  ])
  return new Map(records.map((department) => [department._id.toString(), department.name]))
}

const makeStatusMap = async (employeeIds, from, to) => {
  if (!employeeIds.length) return new Map()
  const records = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: from, $lte: to },
      },
    },
    {
      $project: {
        employee: 1,
        date: 1,
        workedHours: 1,
        computedStatus: {
          $cond: [
            { $eq: ['$checkOut', null] },
            'missing_checkout',
            '$status',
          ],
        },
      },
    },
    {
      $group: {
        _id: { employee: '$employee', date: '$date' },
        status: { $first: '$computedStatus' },
        workedHours: { $sum: '$workedHours' },
      },
    },
  ])
  return new Map(records.map((record) => [
    `${record._id.employee}:${record._id.date}`,
    { status: record.status, workedHours: record.workedHours || 0 },
  ]))
}

const makeApprovedLeaveMap = async (employeeIds, from, to) => {
  if (!employeeIds.length) return new Map()
  const requests = await LeaveRequest.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        status: 'approved',
        startDate: { $lte: to },
        endDate: { $gte: from },
      },
    },
    {
      $lookup: {
        from: LeaveType.collection.name,
        localField: 'leaveType',
        foreignField: '_id',
        as: 'leaveType',
      },
    },
    { $unwind: { path: '$leaveType', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        employee: 1,
        startDate: 1,
        endDate: 1,
        isPaid: '$leaveType.isPaid',
        leaveTypeId: '$leaveType._id',
        leaveTypeName: '$leaveType.name',
      },
    },
  ])
  const byEmployeeDate = new Map()
  for (const request of requests) {
    const first = request.startDate < from ? from : request.startDate
    const last = request.endDate > to ? to : request.endDate
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const key = `${request.employee}:${date}`
      const existing = byEmployeeDate.get(key) || []
      existing.push({
        isPaid: request.isPaid !== false,
        leaveTypeId: request.leaveTypeId?.toString(),
        leaveTypeName: request.leaveTypeName || 'Unknown leave',
      })
      byEmployeeDate.set(key, existing)
    }
  }
  return byEmployeeDate
}

const attendanceStatsForDate = ({ date, employees, statuses, leaves, company, holidays }) => {
  const totals = {
    present: 0,
    late: 0,
    missingCheckout: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    expectedDays: 0,
  }
  if (!isWorkingDate(date, company, holidays)) return totals

  for (const employee of employees) {
    if (!isEmployedOn(employee, date)) continue
    totals.expectedDays += 1
    const key = `${employee._id}:${date}`
    const status = statuses.get(key)?.status
    if (status) {
      if (status === 'present') totals.present += 1
      else if (status === 'late') totals.late += 1
      else if (status === 'missing_checkout') totals.missingCheckout += 1
      else if (status === 'half_day') totals.halfDay += 1
      else if (status === 'absent') totals.absent += 1
      continue
    }
    const approvedLeaves = leaves.get(key) || []
    if (approvedLeaves.length) totals.onLeave += 1
    else totals.absent += 1
  }
  return totals
}

const getAttendanceAnalytics = async (from, to, company, departmentId, workingDates) => {
  if (!workingDates.length) return { byDay: [], byDepartment: [] }
  const pipeline = [
    ...employeePeriodPipeline(from, to, departmentId, to),
    { $addFields: { __dashboardDates: { $literal: workingDates } } },
    { $unwind: '$__dashboardDates' },
    {
      $match: {
        $expr: {
          $and: [
            { $lte: ['$joinDate', '$__dashboardDates'] },
            {
              $or: [
                { $ne: ['$status', 'exited'] },
                { $gte: ['$exitDate', '$__dashboardDates'] },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: Attendance.collection.name,
        let: { employeeId: '$_id', date: '$__dashboardDates' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$employee', '$$employeeId'] },
                  { $eq: ['$date', '$$date'] },
                ],
              },
            },
          },
          {
            $project: {
              computedStatus: {
                $cond: [{ $eq: ['$checkOut', null] }, 'missing_checkout', '$status'],
              },
            },
          },
          { $limit: 1 },
        ],
        as: '__attendance',
      },
    },
    {
      $lookup: {
        from: LeaveRequest.collection.name,
        let: { employeeId: '$_id', date: '$__dashboardDates' },
        pipeline: [
          {
            $match: {
              status: 'approved',
              $expr: {
                $and: [
                  { $eq: ['$employee', '$$employeeId'] },
                  { $lte: ['$startDate', '$$date'] },
                  { $gte: ['$endDate', '$$date'] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: '__approvedLeave',
      },
    },
    {
      $addFields: {
        __status: {
          $cond: [
            { $gt: [{ $size: '$__attendance' }, 0] },
            { $arrayElemAt: ['$__attendance.computedStatus', 0] },
            {
              $cond: [
                { $gt: [{ $size: '$__approvedLeave' }, 0] },
                'on_leave',
                'absent',
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          date: '$__dashboardDates',
          department: '$department',
          status: '$__status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $facet: {
        byDay: [
          {
            $group: {
              _id: '$_id.date',
              present: { $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] } },
              late: { $sum: { $cond: [{ $eq: ['$_id.status', 'late'] }, '$count', 0] } },
              missingCheckout: { $sum: { $cond: [{ $eq: ['$_id.status', 'missing_checkout'] }, '$count', 0] } },
              halfDay: { $sum: { $cond: [{ $eq: ['$_id.status', 'half_day'] }, '$count', 0] } },
              absent: { $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] } },
              onLeave: { $sum: { $cond: [{ $eq: ['$_id.status', 'on_leave'] }, '$count', 0] } },
              expectedDays: { $sum: '$count' },
            },
          },
          {
            $addFields: {
              attendanceDenominator: { $subtract: ['$expectedDays', '$onLeave'] },
              attendanceNumerator: {
                $add: ['$present', '$late', '$missingCheckout', { $multiply: ['$halfDay', 0.5] }],
              },
              lateDenominator: { $add: ['$present', '$late'] },
            },
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              present: 1,
              late: 1,
              missingCheckout: 1,
              halfDay: 1,
              absent: 1,
              onLeave: 1,
              expectedDays: 1,
              attendanceRate: {
                $cond: [
                  { $gt: ['$attendanceDenominator', 0] },
                  { $round: [{ $multiply: [{ $divide: ['$attendanceNumerator', '$attendanceDenominator'] }, 100] }, 2] },
                  0,
                ],
              },
              latePercent: {
                $cond: [
                  { $gt: ['$lateDenominator', 0] },
                  { $round: [{ $multiply: [{ $divide: ['$late', '$lateDenominator'] }, 100] }, 2] },
                  0,
                ],
              },
            },
          },
          { $sort: { date: 1 } },
        ],
        byDepartment: [
          {
            $group: {
              _id: '$_id.department',
              absentDays: { $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] } },
              expectedDays: { $sum: { $cond: [{ $ne: ['$_id.status', 'on_leave'] }, '$count', 0] } },
            },
          },
          {
            $addFields: {
              absenteeismRate: {
                $cond: [
                  { $gt: ['$expectedDays', 0] },
                  { $round: [{ $multiply: [{ $divide: ['$absentDays', '$expectedDays'] }, 100] }, 2] },
                  0,
                ],
              },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]
  const [result] = await Employee.aggregate(pipeline)
  return result || { byDay: [], byDepartment: [] }
}

const countHeadcount = async (date, departmentId) => {
  const match = {
    joinDate: { $lte: date },
    $or: [
      { status: { $in: ['active', 'probation'] } },
      { status: 'exited', exitDate: { $gte: date } },
    ],
  }
  if (departmentId) match.department = departmentId
  const [result] = await Employee.aggregate([
    { $match: match },
    { $count: 'headcount' },
  ])
  return result?.headcount || 0
}

const lateCheckInPipeline = (from, to, company, departmentId) => {
  const cutoffMinutes = getMinutes(company.officeStart) + company.graceMinutes
  if (cutoffMinutes >= 24 * 60) return [{ $match: { _id: { $exists: false } } }]
  const cutoff = `${String(Math.floor(cutoffMinutes / 60)).padStart(2, '0')}:${String(cutoffMinutes % 60).padStart(2, '0')}:00`
  return [
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $lookup: {
        from: Employee.collection.name,
        localField: 'employee',
        foreignField: '_id',
        as: 'employee',
      },
    },
    { $unwind: '$employee' },
    ...(departmentId ? [{ $match: { 'employee.department': departmentId } }] : []),
    {
      $addFields: {
        __cutoff: {
          $dateFromString: {
            dateString: { $concat: ['$date', 'T', cutoff] },
            timezone: company.timezone,
          },
        },
      },
    },
    { $match: { $expr: { $gt: ['$checkIn', '$__cutoff'] } } },
  ]
}

const getHrDashboard = async (user, filters) => {
  assertRole(user, ['admin', 'hr'])
  const { company, from, to, departmentId } = await validateFilters(filters)
  const today = getLocalDate(new Date(), company.timezone)
  const effectiveTo = to < today ? to : today
  const hasElapsedRange = from <= effectiveTo
  const dateStart = hasElapsedRange ? from : today
  const dateEnd = hasElapsedRange ? effectiveTo : today
  const [trendHolidays, todayHolidays, periodHolidays, todayHeadcount] = await Promise.all([
    getHolidaySet(dateStart, dateEnd),
    getHolidaySet(today, today),
    getHolidaySet(from, to),
    countHeadcount(today, departmentId),
  ])
  const workDates = hasElapsedRange ? getWorkingDates(from, effectiveTo, company, trendHolidays) : []
  const todayWorkDates = isWorkingDate(today, company, todayHolidays) ? [today] : []
  const [periodAttendance, todayAttendance] = await Promise.all([
    getAttendanceAnalytics(dateStart, dateEnd, company, departmentId, workDates),
    getAttendanceAnalytics(today, today, company, departmentId, todayWorkDates),
  ])
  const attendanceTrend = periodAttendance.byDay
  const todayStats = todayAttendance.byDay[0] || { present: 0, onLeave: 0 }

  const pendingLeavePipeline = [
    { $match: { status: 'pending' } },
    {
      $lookup: {
        from: Employee.collection.name,
        localField: 'employee',
        foreignField: '_id',
        as: 'employee',
      },
    },
    { $unwind: '$employee' },
    ...(departmentId ? [{ $match: { 'employee.department': departmentId } }] : []),
    { $count: 'count' },
  ]
  const pendingCorrectionPipeline = [
    { $match: { status: 'pending' } },
    {
      $lookup: {
        from: Employee.collection.name,
        localField: 'employee',
        foreignField: '_id',
        as: 'employee',
      },
    },
    { $unwind: '$employee' },
    ...(departmentId ? [{ $match: { 'employee.department': departmentId } }] : []),
    { $count: 'count' },
  ]
  const [leavePending, correctionPending, lateGroups, approvedLeaves, lateTodayResult] = await Promise.all([
    LeaveRequest.aggregate(pendingLeavePipeline),
    AttendanceCorrection.aggregate(pendingCorrectionPipeline),
    Attendance.aggregate([
      ...lateCheckInPipeline(from, to, company, departmentId),
      {
        $group: {
          _id: '$employee._id',
          name: { $first: '$employee.name' },
          code: { $first: '$employee.code' },
          department: { $first: '$employee.department' },
          lateCount: { $sum: 1 },
        },
      },
      { $sort: { lateCount: -1, name: 1, _id: 1 } },
      { $limit: 5 },
    ]),
    LeaveRequest.aggregate([
      {
        $match: {
          status: 'approved',
          startDate: { $lte: to },
          endDate: { $gte: from },
        },
      },
      {
        $lookup: {
          from: Employee.collection.name,
          localField: 'employee',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      ...(departmentId ? [{ $match: { 'employee.department': departmentId } }] : []),
      {
        $lookup: {
          from: LeaveType.collection.name,
          localField: 'leaveType',
          foreignField: '_id',
          as: 'leaveType',
        },
      },
      { $unwind: { path: '$leaveType', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          startDate: 1,
          endDate: 1,
          days: 1,
          leaveTypeId: '$leaveType._id',
          name: '$leaveType.name',
          yearlyQuota: '$leaveType.yearlyQuota',
          isUnlimited: '$leaveType.isUnlimited',
        },
      },
    ]),
    Attendance.aggregate([
      ...lateCheckInPipeline(today, today, company, departmentId),
      { $count: 'count' },
    ]),
  ])

  const leaveDaysByType = new Map()
  for (const leave of approvedLeaves) {
    const first = leave.startDate < from ? from : leave.startDate
    const last = leave.endDate > to ? to : leave.endDate
    const days = getWorkingDates(first, last, company, periodHolidays).length
    const key = leave.leaveTypeId?.toString() || 'unknown'
    const current = leaveDaysByType.get(key) || {
      leaveTypeId: key,
      name: leave.name || 'Unknown leave',
      yearlyQuota: leave.yearlyQuota ?? null,
      isUnlimited: Boolean(leave.isUnlimited),
      approvedDays: 0,
    }
    current.approvedDays += days
    leaveDaysByType.set(key, current)
  }
  const leaveByType = [...leaveDaysByType.values()].map((item) => ({
    ...item,
    utilizationPercent: item.isUnlimited || !item.yearlyQuota
      ? null
      : Math.round((item.approvedDays / item.yearlyQuota) * 10000) / 100,
  }))

  const names = await departmentNameMap(lateGroups.map((item) => item.department))
  const absenteeismDepartmentNames = await departmentNameMap(
    periodAttendance.byDepartment.map((item) => item._id),
  )
  const absenteeismByDepartment = periodAttendance.byDepartment.map((item) => ({
    departmentId: item._id?.toString() || null,
    department: absenteeismDepartmentNames.get(item._id?.toString()) || 'Unassigned',
    absentDays: item.absentDays,
    expectedDays: item.expectedDays,
    absenteeismRate: item.absenteeismRate,
  }))
  const announcements = await Announcement.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(5)
    .select('title message createdAt')
    .lean()

  return {
    from,
    to,
    headcount: todayHeadcount,
    presentToday: todayStats.present,
    onLeaveToday: todayStats.onLeave,
    lateToday: lateTodayResult[0]?.count || 0,
    pendingApprovals: {
      leave: leavePending[0]?.count || 0,
      attendanceCorrections: correctionPending[0]?.count || 0,
      total: (leavePending[0]?.count || 0) + (correctionPending[0]?.count || 0),
    },
    attendanceTrend,
    absenteeismByDepartment,
    leaveByType,
    topLateComers: lateGroups.map((item) => ({
      employeeId: item._id.toString(),
      name: item.name,
      code: item.code,
      department: names.get(item.department?.toString()) || null,
      lateCount: item.lateCount,
    })),
    announcements: announcements.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

const getAbsenteeismByDepartment = async ({
  employees,
  statuses,
  leaves,
  company,
  holidays,
  workDates,
}) => {
  const departmentIds = [...new Set(employees.map((employee) => employee.department?.toString() || null))]
  const departmentNames = await departmentNameMap(departmentIds)
  const groups = new Map()
  for (const departmentId of departmentIds) {
    const id = departmentId || 'unassigned'
    groups.set(id, {
      departmentId: departmentId || null,
      department: departmentNames.get(departmentId) || 'Unassigned',
      absentDays: 0,
      expectedDays: 0,
    })
  }

  for (const date of workDates) {
    if (!isWorkingDate(date, company, holidays)) continue
    for (const employee of employees) {
      if (!isEmployedOn(employee, date)) continue
      const groupId = employee.department?.toString() || 'unassigned'
      const group = groups.get(groupId)
      if (!group) continue
      group.expectedDays += 1
      const key = `${employee._id}:${date}`
      if (!statuses.has(key) && !(leaves.get(key) || []).length) {
        group.absentDays += 1
      } else if (statuses.get(key)?.status === 'absent') {
        group.absentDays += 1
      }
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      absenteeismRate: group.expectedDays
        ? Math.round((group.absentDays / group.expectedDays) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => a.department.localeCompare(b.department))
}

const getAdminDashboard = async (user, filters) => {
  assertRole(user, ['admin'])
  const { company, from, to, departmentId } = await validateFilters(filters, (settings) => {
    const to = getLocalDate(new Date(), settings.timezone)
    return { from: `${to.slice(0, 4)}-01-01`, to }
  })
  const monthFrom = from.slice(0, 7)
  const monthTo = to.slice(0, 7)
  const [headcount, startDateRecords, endDateRecords, exits] = await Promise.all([
    countHeadcount(to, departmentId),
    Employee.aggregate(employeeSnapshotPipeline(from, departmentId)),
    Employee.aggregate(employeeSnapshotPipeline(to, departmentId)),
    Employee.aggregate([
      {
        $match: {
          status: 'exited',
          exitDate: { $gte: from, $lte: to },
          ...(departmentId ? { department: departmentId } : {}),
        },
      },
      { $count: 'exits' },
    ]),
  ])
  const startCount = startDateRecords.filter((employee) => isEmployedOn(employee, from)).length
  const endCount = endDateRecords.filter((employee) => isEmployedOn(employee, to)).length
  const averageHeadcount = (startCount + endCount) / 2
  const exitCount = exits[0]?.exits || 0
  const employeeSummaries = await Employee.aggregate([
    ...employeeSnapshotPipeline(to, departmentId),
    {
      $group: {
        _id: '$department',
        headcount: { $sum: 1 },
        averageGrossSalary: { $avg: { $multiply: ['$basicSalary', 1.5] } },
      },
    },
  ])
  const averageSalaryTotal = employeeSummaries.reduce(
    (sum, item) => sum + (item.averageGrossSalary || 0) * item.headcount,
    0,
  )
  const averageSalaryCount = employeeSummaries.reduce((sum, item) => sum + item.headcount, 0)
  const yearThreshold = (date, years) => {
    const value = new Date(`${date}T00:00:00.000Z`)
    value.setUTCFullYear(value.getUTCFullYear() - years)
    return value.toISOString().slice(0, 10)
  }
  const underOneYear = yearThreshold(to, 1)
  const underThreeYears = yearThreshold(to, 3)
  const underFiveYears = yearThreshold(to, 5)
  const [
    salaryByDepartmentDesignation,
    genderGroups,
    tenureGroups,
    payrollItems,
  ] = await Promise.all([
    Employee.aggregate([
      ...employeeSnapshotPipeline(to, departmentId),
      {
        $group: {
          _id: { department: '$department', designation: '$designation' },
          headcount: { $sum: 1 },
          averageGrossSalary: { $avg: { $multiply: ['$basicSalary', 1.5] } },
        },
      },
    ]),
    Employee.aggregate([
      ...employeeSnapshotPipeline(to, departmentId),
      { $group: { _id: '$gender', headcount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Employee.aggregate([
      ...employeeSnapshotPipeline(to, departmentId),
      {
        $addFields: {
          tenureRange: {
            $switch: {
              branches: [
                { case: { $gt: ['$joinDate', underOneYear] }, then: 'Under 1 year' },
                { case: { $gt: ['$joinDate', underThreeYears] }, then: '1-3 years' },
                { case: { $gt: ['$joinDate', underFiveYears] }, then: '3-5 years' },
              ],
              default: '5+ years',
            },
          },
        },
      },
      { $group: { _id: '$tenureRange', headcount: { $sum: 1 } } },
    ]),
    PayrollItem.aggregate([
      {
        $lookup: {
          from: PayrollRun.collection.name,
          localField: 'run',
          foreignField: '_id',
          as: 'run',
        },
      },
      { $unwind: '$run' },
      {
        $match: {
          'run.status': 'finalized',
          'run.month': { $gte: monthFrom, $lte: monthTo },
        },
      },
      {
        $lookup: {
          from: Employee.collection.name,
          localField: 'employee',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      ...(departmentId ? [{ $match: { 'employee.department': departmentId } }] : []),
      {
        $facet: {
          totals: [
            { $group: { _id: null, gross: { $sum: '$gross' }, net: { $sum: '$netPay' } } },
          ],
          byMonth: [
            {
              $group: {
                _id: '$run.month',
                gross: { $sum: '$gross' },
                net: { $sum: '$netPay' },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, month: '$_id', gross: 1, net: 1 } },
          ],
          byDepartment: [
            {
              $group: {
                _id: '$employee.department',
                gross: { $sum: '$gross' },
                net: { $sum: '$netPay' },
              },
            },
          ],
        },
      },
    ]),
  ])

  const departmentNames = await departmentNameMap([
    ...employeeSummaries.map(({ _id }) => _id),
    ...(payrollItems[0]?.byDepartment || []).map((item) => item._id),
    ...salaryByDepartmentDesignation.map((item) => item._id.department),
  ])
  const designationNames = await designationNameMap(
    salaryByDepartmentDesignation.map((item) => item._id.designation),
  )
  const headcountByDepartment = employeeSummaries.map((item) => ({
    departmentId: item._id?.toString() || null,
    department: departmentNames.get(item._id?.toString()) || 'Unassigned',
    headcount: item.headcount,
  }))
  const averageSalaryByDepartmentDesignation = salaryByDepartmentDesignation.map((item) => ({
    departmentId: item._id.department?.toString() || null,
    department: departmentNames.get(item._id.department?.toString()) || 'Unassigned',
    designationId: item._id.designation?.toString() || null,
    designation: designationNames.get(item._id.designation?.toString()) || 'Unassigned',
    averageGrossSalary: item.averageGrossSalary || 0,
    headcount: item.headcount,
  }))
  const payrollSummary = payrollItems[0] || { totals: [], byMonth: [], byDepartment: [] }
  const payrollByDepartment = payrollSummary.byDepartment.map((item) => ({
    departmentId: item._id?.toString() || null,
    department: departmentNames.get(item._id?.toString()) || 'Unassigned',
    gross: item.gross,
    net: item.net,
  })).sort((a, b) => a.department.localeCompare(b.department))

  const tenureCounts = new Map(tenureGroups.map((item) => [item._id, item.headcount]))
  const tenureRanges = ['Under 1 year', '1-3 years', '3-5 years', '5+ years']
    .map((range) => ({ range, headcount: tenureCounts.get(range) || 0 }))
  const [auditEntries, announcements] = await Promise.all([
    AuditLog.find()
      .populate('actor', 'name email role')
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean(),
    Announcement.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .select('title message createdAt')
      .lean(),
  ])

  return {
    from,
    to,
    headcount,
    attrition: {
      exits: exitCount,
      averageHeadcount,
      rate: averageHeadcount ? Math.round((exitCount / averageHeadcount) * 10000) / 100 : 0,
    },
    payrollCost: {
      gross: payrollSummary.totals[0]?.gross || 0,
      net: payrollSummary.totals[0]?.net || 0,
      byMonth: payrollSummary.byMonth,
      byDepartment: payrollByDepartment,
    },
    averageSalary: averageSalaryCount ? averageSalaryTotal / averageSalaryCount : 0,
    averageSalaryByDepartmentDesignation,
    headcountByDepartment,
    genderBreakdown: genderGroups.map((item) => ({
      gender: item._id || 'unknown',
      headcount: item.headcount,
    })),
    tenureBreakdown: tenureRanges,
    auditFeed: auditEntries.map((entry) => ({
      id: entry._id.toString(),
      actor: entry.actor?.name || 'Inactive user',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.createdAt.toISOString(),
    })),
    announcements: announcements.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

const getEmployeeDashboard = async (user) => {
  assertRole(user, ['employee'])
  const employeeId = resolveEmployeeScope(user)
  const company = await getCompany()
  const [employee] = await Employee.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(employeeId) } },
    { $project: { _id: 1, joinDate: 1, status: 1, exitDate: 1 } },
  ])
  if (!employee) throw new AppError(404, 'Employee profile was not found.')
  const today = getLocalDate(new Date(), company.timezone)
  const [year] = today.split('-').map(Number)
  const monthStart = `${today.slice(0, 7)}-01`
  const mondayOffset = (new Date(`${today}T00:00:00.000Z`).getUTCDay() + 6) % 7
  const weekStart = addDays(today, -mondayOffset)
  const yearStart = `${year}-01-01`
  const [todayAttendance] = await Attendance.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(employeeId), date: today } },
    {
      $project: {
        checkIn: 1,
        checkOut: 1,
        workedHours: 1,
        status: {
          $cond: [{ $eq: ['$checkOut', null] }, 'missing_checkout', '$status'],
        },
      },
    },
    { $limit: 1 },
  ])
  const [weekHours, lateResult, holidaySet] = await Promise.all([
    Attendance.aggregate([
      {
        $match: {
          employee: new mongoose.Types.ObjectId(employeeId),
          date: { $gte: weekStart, $lte: today },
        },
      },
      {
        $group: {
          _id: null,
          workedHours: {
            $sum: {
              $cond: [
                { $eq: ['$checkOut', null] },
                {
                  $max: [
                    0,
                    { $divide: [{ $subtract: ['$$NOW', '$checkIn'] }, 3600000] },
                  ],
                },
                '$workedHours',
              ],
            },
          },
        },
      },
    ]),
    Attendance.aggregate([
      {
        $match: {
          employee: new mongoose.Types.ObjectId(employeeId),
          date: { $gte: monthStart, $lte: today },
        },
      },
      ...lateCheckInPipeline(monthStart, today, company, null).slice(1),
      { $count: 'count' },
    ]),
    getHolidaySet(yearStart, today),
  ])

  const [todayLeave] = await LeaveRequest.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        status: 'approved',
        startDate: { $lte: today },
        endDate: { $gte: today },
      },
    },
    { $limit: 1 },
  ])
  let todayStatus = todayAttendance?.status || null
  if (!todayStatus && todayLeave) todayStatus = 'on_leave'
  if (
    !todayStatus &&
    isEmployedOn(employee, today) &&
    isWorkingDate(today, company, holidaySet)
  ) {
    todayStatus = 'absent'
  }

  const leaveTypes = await LeaveType.aggregate([
    { $sort: { name: 1, _id: 1 } },
    {
      $lookup: {
        from: LeaveRequest.collection.name,
        let: { typeId: '$_id' },
        pipeline: [
          {
            $match: {
              employee: new mongoose.Types.ObjectId(employeeId),
              status: 'approved',
              startDate: { $lte: `${year}-12-31` },
              endDate: { $gte: yearStart },
              $expr: { $eq: ['$leaveType', '$$typeId'] },
            },
          },
          { $project: { startDate: 1, endDate: 1 } },
        ],
        as: 'approvedRequests',
      },
    },
    {
      $project: {
        name: 1,
        yearlyQuota: 1,
        isUnlimited: 1,
        approvedRequests: 1,
      },
    },
  ])
  const yearHolidays = await getHolidaySet(yearStart, `${year}-12-31`)
  const leaveBalance = {
    year,
    leaveTypes: leaveTypes.map((type) => {
      const used = type.approvedRequests.reduce((total, request) => {
        const start = request.startDate < yearStart ? yearStart : request.startDate
        const end = request.endDate > `${year}-12-31` ? `${year}-12-31` : request.endDate
        return total + getWorkingDates(start, end, company, yearHolidays).length
      }, 0)
      return {
        id: type._id.toString(),
        name: type.name,
        yearlyQuota: type.isUnlimited ? null : type.yearlyQuota,
        isUnlimited: type.isUnlimited,
        used,
        remaining: type.isUnlimited ? null : Math.max(0, type.yearlyQuota - used),
      }
    }),
  }

  const [lastPayslip] = await PayrollItem.aggregate([
    { $match: { employee: new mongoose.Types.ObjectId(employeeId) } },
    {
      $lookup: {
        from: PayrollRun.collection.name,
        localField: 'run',
        foreignField: '_id',
        as: 'run',
      },
    },
    { $unwind: '$run' },
    { $match: { 'run.status': 'finalized' } },
    { $sort: { 'run.month': -1 } },
    { $limit: 1 },
    {
      $project: {
        id: { $toString: '$_id' },
        month: '$run.month',
        gross: 1,
        netPay: 1,
      },
    },
  ])
  const announcementRecords = await Announcement.find()
    .sort({ createdAt: -1, _id: -1 })
    .limit(5)
    .select('title message createdAt')
    .lean()

  return {
    today: {
      date: today,
      status: todayStatus,
      checkInTime: todayAttendance?.checkIn
        ? new Intl.DateTimeFormat('en-GB', {
            timeZone: company.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(todayAttendance.checkIn)
        : null,
      workedHours: todayAttendance?.workedHours || 0,
    },
    week: {
      workedHours: weekHours[0]?.workedHours || 0,
      targetHours: 40,
    },
    lateCountThisMonth: lateResult[0]?.count || 0,
    leaveBalance,
    lastPayslip: lastPayslip || null,
    announcements: announcementRecords.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

module.exports = {
  getHrDashboard,
  getAdminDashboard,
  getEmployeeDashboard,
}
