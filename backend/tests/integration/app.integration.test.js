const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { after, test } = require('node:test')
const mongoose = require('mongoose')
const request = require('supertest')
const { MongoMemoryReplSet } = require('mongodb-memory-server')

process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex')
process.env.FRONTEND_URL = 'http://localhost:5173,https://hcm-demo.vercel.app'
process.env.AI_API_KEY = 'integration-test-key-do-not-use'
const adminPassword = crypto.randomBytes(24).toString('base64url')
const rejectedSetupPassword = crypto.randomBytes(24).toString('base64url')
const hrNewPassword = crypto.randomBytes(24).toString('base64url')
const employeeOneNewPassword = crypto.randomBytes(24).toString('base64url')
const employeeTwoNewPassword = crypto.randomBytes(24).toString('base64url')

const app = require('../../src/app')
const { addDays, getLocalDate, getWeekday } = require('../../src/utils/attendance-time')
const aiService = require('../../src/services/ai.service')

let replSet

after(async () => {
  aiService.setAiClientForTesting(null)
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  if (replSet) await replSet.stop()
})

const call = (method, path, token, body) => {
  let operation = request(app)[method](path)
  if (token) operation = operation.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) operation = operation.send(body)
  return operation
}

const login = async (email, password) => {
  const response = await call('post', '/api/auth/login', null, { email, password })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body
}

const workingDates = (start, count, weekend, holidays = new Set()) => {
  const dates = []
  for (let date = start; dates.length < count; date = addDays(date, 1)) {
    if (!weekend.includes(getWeekday(date)) && !holidays.has(date)) dates.push(date)
  }
  return dates
}

const employeePayload = ({ code, name, email, department, designation, joinDate, salary }) => ({
  code,
  name,
  email,
  phone: '03001234567',
  address: 'Test Street',
  gender: 'prefer_not_to_say',
  department,
  designation,
  joinDate,
  status: 'active',
  basicSalary: salary,
})

test('full HCM API flow against a real MongoDB replica set', { timeout: 240000 }, async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  process.env.MONGO_URI = replSet.getUri()
  assert.equal(require('../../src/index'), app)
  const preflight = await request(app)
    .options('/api/setup')
    .set('Origin', 'https://hcm-demo.vercel.app')
    .set('Access-Control-Request-Method', 'POST')
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://hcm-demo.vercel.app')
  assert.equal(mongoose.connection.readyState, 0)
  const health = await request(app).get('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.status, 'ok')
  assert.equal(mongoose.connection.readyState, 1)
  assert.ok(globalThis.__hcmLiteMongoConnectionPromise)
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()))

  const Company = mongoose.model('Company')
  const User = mongoose.model('User')
  const Employee = mongoose.model('Employee')
  const Attendance = mongoose.model('Attendance')
  const LeaveRequest = mongoose.model('LeaveRequest')
  const PayrollRun = mongoose.model('PayrollRun')
  const PayrollItem = mongoose.model('PayrollItem')
  const Notification = mongoose.model('Notification')
  const AuditLog = mongoose.model('AuditLog')
  const AiLog = mongoose.model('AiLog')
  const AiRequestWindow = mongoose.model('AiRequestWindow')

  assert.equal(await User.countDocuments(), 0)
  assert.equal(await Company.countDocuments(), 0)
  assert.equal((await call('get', '/api/setup/status')).body.setupComplete, false)

  const setup = await call('post', '/api/setup', null, {
    companyName: 'Integration HCM',
    adminName: 'Test Admin',
    email: 'admin@example.test',
    password: adminPassword,
  })
  assert.equal(setup.status, 201, JSON.stringify(setup.body))
  assert.equal(setup.body.user.role, 'admin')
  assert.equal(JSON.stringify(setup.body).includes('passwordHash'), false)
  assert.equal(JSON.stringify(setup.body).includes(adminPassword), false)
  assert.equal((await call('post', '/api/setup', null, {
    companyName: 'Second Company',
    adminName: 'Other Admin',
    email: 'other@example.test',
    password: rejectedSetupPassword,
  })).status, 403)

  const admin = await login('admin@example.test', adminPassword)
  const adminToken = admin.token
  assert.equal(admin.user.mustChangePassword, false)

  const initialCompany = await call('get', '/api/settings/company', adminToken)
  assert.equal(initialCompany.status, 200)
  assert.equal(initialCompany.body.company.officeStart, '09:00')
  assert.equal(initialCompany.body.company.graceMinutes, 15)
  assert.equal(initialCompany.body.company.halfDayHours, 5)
  assert.deepEqual(initialCompany.body.company.weekend, ['Sat', 'Sun'])
  assert.equal(initialCompany.body.company.timezone, 'Asia/Karachi')
  assert.equal((await call('get', '/api/settings/departments', adminToken)).body.departments.length, 0)

  const dept = await call('post', '/api/settings/departments', adminToken, { name: 'Engineering' })
  const designation = await call('post', '/api/settings/designations', adminToken, { name: 'Engineer' })
  assert.equal(dept.status, 201)
  assert.equal(designation.status, 201)
  const annual = await call('post', '/api/settings/leave-types', adminToken, {
    name: 'Annual', yearlyQuota: 14, isUnlimited: false, isPaid: true,
  })
  const sick = await call('post', '/api/settings/leave-types', adminToken, {
    name: 'Sick', yearlyQuota: 8, isUnlimited: false, isPaid: true,
  })
  const casual = await call('post', '/api/settings/leave-types', adminToken, {
    name: 'Casual', yearlyQuota: 10, isUnlimited: false, isPaid: true,
  })
  const unpaid = await call('post', '/api/settings/leave-types', adminToken, {
    name: 'Unpaid', yearlyQuota: null, isUnlimited: true, isPaid: false,
  })
  assert.deepEqual([annual.status, sick.status, casual.status, unpaid.status], [201, 201, 201, 201])
  assert.equal(unpaid.body.leaveType.yearlyQuota, null)
  assert.equal((await call('post', '/api/settings/departments', adminToken, { name: 'Engineering' })).status, 409)

  const today = getLocalDate(new Date(), 'Asia/Karachi')
  const currentWeekday = getWeekday(today)
  const testWeekend = currentWeekday === 'Sat' ? ['Sun'] : ['Sat']
  const updateSettings = await call('patch', '/api/settings/company', adminToken, {
    officeStart: '00:00',
    graceMinutes: 0,
    halfDayHours: 5,
    weekend: testWeekend,
  })
  assert.equal(updateSettings.status, 200, JSON.stringify(updateSettings.body))

  const leaveDates = workingDates(addDays(today, 7), 5, ['Sat', 'Sun'])
  const holidayDate = leaveDates[1]
  const holiday = await call('post', '/api/settings/holidays', adminToken, {
    date: holidayDate,
    name: 'Integration holiday',
  })
  assert.equal(holiday.status, 201)

  const hrCreate = await call('post', '/api/settings/hr-users', adminToken, {
    name: 'Test HR',
    email: 'hr@example.test',
  })
  assert.equal(hrCreate.status, 201, JSON.stringify(hrCreate.body))
  assert.equal(hrCreate.body.hrUser.mustChangePassword, true)
  assert.ok(hrCreate.body.temporaryPassword)
  const hrPassword = hrCreate.body.temporaryPassword
  assert.equal(JSON.stringify(hrCreate.body.hrUser).includes('passwordHash'), false)
  const hrLogin = await login('hr@example.test', hrPassword)
  const hrToken = hrLogin.token
  assert.equal(hrLogin.user.mustChangePassword, true)
  assert.equal((await call('get', '/api/settings/departments', hrToken)).status, 403)
  assert.equal((await call('get', '/api/auth/me', hrToken)).status, 200)
  const hrPasswordChange = await call('post', '/api/auth/change-password', hrToken, {
    currentPassword: hrPassword,
    newPassword: hrNewPassword,
  })
  assert.equal(hrPasswordChange.status, 200)
  assert.equal(hrPasswordChange.body.user.mustChangePassword, false)

  assert.equal((await call('patch', '/api/settings/company', hrToken, { graceMinutes: 10 })).status, 403)
  assert.equal((await call('get', '/api/audit-logs', hrToken)).status, 403)
  assert.equal((await call('get', '/api/dashboard/admin', hrToken)).status, 403)
  assert.equal((await call('post', '/api/announcements', hrToken, { title: '', message: '' })).status, 400)

  const joinDate = `${today.slice(0, 7)}-01`
  const firstCreate = await call('post', '/api/employees', hrToken, employeePayload({
    code: 'EMP001', name: 'Employee One', email: 'one@example.test',
    department: dept.body.department.id, designation: designation.body.designation.id,
    joinDate, salary: 100000,
  }))
  const secondCreate = await call('post', '/api/employees', hrToken, employeePayload({
    code: 'EMP002', name: 'Employee Two', email: 'two@example.test',
    department: dept.body.department.id, designation: designation.body.designation.id,
    joinDate, salary: 120000,
  }))
  assert.equal(firstCreate.status, 201, JSON.stringify(firstCreate.body))
  assert.equal(secondCreate.status, 201, JSON.stringify(secondCreate.body))
  assert.equal(await Employee.countDocuments(), 2)
  assert.equal(await User.countDocuments({ role: 'employee' }), 2)
  assert.ok(firstCreate.body.temporaryPassword)
  assert.ok(secondCreate.body.temporaryPassword)
  assert.equal(JSON.stringify(firstCreate.body.employee).includes('passwordHash'), false)
  const employee1Id = firstCreate.body.employee.id
  const employee2Id = secondCreate.body.employee.id

  const employee1Login = await login('one@example.test', firstCreate.body.temporaryPassword)
  const employee2Login = await login('two@example.test', secondCreate.body.temporaryPassword)
  assert.equal(employee1Login.user.mustChangePassword, true)
  const employee1Token = employee1Login.token
  const employee2Token = employee2Login.token
  assert.equal((await call('get', '/api/settings/company', employee1Token)).status, 403)
  assert.equal((await call('get', `/api/employees/${employee2Id}`, employee1Token)).status, 403)
  assert.equal((await call('put', `/api/employees/${employee1Id}`, employee1Token, {
    phone: '03001111111',
    address: 'Own Address',
    basicSalary: 1,
  })).status, 403)
  assert.equal((await call('get', '/api/dashboard/hr', employee1Token)).status, 403)
  assert.equal((await call('get', '/api/dashboard/admin', employee1Token)).status, 403)
  assert.equal((await call('get', '/api/audit-logs', employee1Token)).status, 403)
  assert.equal((await call('post', '/api/announcements', employee1Token, {
    title: 'Nope', message: 'Employees may not post',
  })).status, 403)
  assert.equal((await call('post', '/api/leave', employee1Token, {
    leaveType: annual.body.leaveType.id,
    startDate: today,
    endDate: today,
    reason: 'Other employee request',
  })).status, 403)
  const employee1PasswordChange = await call('post', '/api/auth/change-password', employee1Token, {
    currentPassword: firstCreate.body.temporaryPassword,
    newPassword: employeeOneNewPassword,
  })
  const employee2PasswordChange = await call('post', '/api/auth/change-password', employee2Token, {
    currentPassword: secondCreate.body.temporaryPassword,
    newPassword: employeeTwoNewPassword,
  })
  assert.equal(employee1PasswordChange.status, 200)
  assert.equal(employee2PasswordChange.status, 200)
  assert.equal((await call('patch', '/api/settings/company', hrToken, { graceMinutes: 10 })).status, 403)
  assert.equal((await call('get', '/api/audit-logs', hrToken)).status, 403)
  assert.equal((await call('get', '/api/dashboard/admin', hrToken)).status, 403)
  assert.equal((await call('put', `/api/employees/${employee1Id}`, employee1Token, {
    phone: '03001111111',
    address: 'Own Address',
    basicSalary: 1,
  })).status, 400)

  const ownProfile = await call('get', `/api/employees/${employee1Id}`, employee1Token)
  assert.equal(ownProfile.status, 200)
  assert.equal(Object.hasOwn(ownProfile.body.employee, 'basicSalary'), false)
  assert.equal(JSON.stringify(ownProfile.body).includes('passwordHash'), false)
  assert.equal((await call('get', '/api/employees', employee1Token)).status, 403)
  assert.equal((await call('post', '/api/employees', adminToken, {})).status, 403)
  assert.equal((await call('put', `/api/employees/${employee1Id}`, adminToken, {})).status, 403)
  const salaryUpdate = await call('put', `/api/employees/${employee1Id}`, hrToken, employeePayload({
    code: 'EMP001', name: 'Employee One', email: 'one@example.test',
    department: dept.body.department.id, designation: designation.body.designation.id,
    joinDate, salary: 110000,
  }))
  assert.equal(salaryUpdate.status, 200, JSON.stringify(salaryUpdate.body))

  const checkIn1 = await call('post', '/api/attendance/check-in', employee1Token, {})
  assert.equal(checkIn1.status, 201, JSON.stringify(checkIn1.body))
  assert.equal(checkIn1.body.attendance.status, 'late')
  assert.equal((await call('post', '/api/attendance/check-in', employee1Token, {})).status, 409)
  const checkOut1 = await call('post', '/api/attendance/check-out', employee1Token, {})
  assert.equal(checkOut1.status, 200)
  assert.equal(checkOut1.body.attendance.status, 'half_day')
  assert.equal((await call('post', '/api/attendance/check-out', employee1Token, {})).status, 409)

  const checkIn2 = await call('post', '/api/attendance/check-in', employee2Token, {})
  assert.equal(checkIn2.status, 201)
  assert.equal(checkIn2.body.attendance.status, 'late')
  assert.equal((await call('post', '/api/attendance/check-out', employee2Token, {})).status, 200)
  const correction1 = await call('post', '/api/attendance/corrections', employee1Token, {
    date: today,
    requestedCheckIn: '00:00',
    requestedCheckOut: '06:00',
    reason: 'Correct missing shift times',
  })
  const correction2 = await call('post', '/api/attendance/corrections', employee2Token, {
    date: today,
    requestedCheckIn: '00:01',
    requestedCheckOut: '06:01',
    reason: 'Correct shift times',
  })
  assert.equal(correction1.status, 201)
  assert.equal(correction2.status, 201)
  assert.equal((await call('post', `/api/attendance/corrections/${correction1.body.correction.id}/approve`, adminToken, { comment: 'approved' })).status, 403)
  const approvedCorrection1 = await call('post', `/api/attendance/corrections/${correction1.body.correction.id}/approve`, hrToken, { comment: 'verified' })
  const approvedCorrection2 = await call('post', `/api/attendance/corrections/${correction2.body.correction.id}/approve`, hrToken, { comment: 'verified' })
  assert.equal(approvedCorrection1.status, 200, JSON.stringify(approvedCorrection1.body))
  assert.equal(approvedCorrection2.status, 200, JSON.stringify(approvedCorrection2.body))
  assert.equal(approvedCorrection1.body.correction.status, 'approved')
  const attendanceAfterCorrection = await Attendance.findOne({ employee: employee1Id, date: today }).lean()
  assert.equal(attendanceAfterCorrection.status, 'present')
  assert.equal(attendanceAfterCorrection.workedHours, 6)

  assert.equal((await call('patch', '/api/settings/company', adminToken, {
    weekend: ['Sat', 'Sun'],
  })).status, 200)
  const skipHoliday = new Set([holidayDate])
  const expectedLeaveDates = leaveDates.filter((date) => (
    !['Sat', 'Sun'].includes(getWeekday(date)) && !skipHoliday.has(date)
  ))
  assert.equal(expectedLeaveDates.length, 4)
  const leaveCreate = await call('post', '/api/leave', employee1Token, {
    leaveType: annual.body.leaveType.id,
    startDate: leaveDates[0],
    endDate: leaveDates[4],
    reason: 'Family event',
  })
  assert.equal(leaveCreate.status, 201, JSON.stringify(leaveCreate.body))
  assert.equal(leaveCreate.body.leave.days, 4)
  assert.equal((await call('post', '/api/leave', employee1Token, {
    leaveType: annual.body.leaveType.id,
    startDate: leaveDates[1],
    endDate: leaveDates[3],
    reason: 'Overlapping request',
  })).status, 422)

  const excessDates = workingDates(addDays(leaveDates[4], 1), 15, ['Sat', 'Sun'])
  const excessLeave = await call('post', '/api/leave', employee1Token, {
    leaveType: annual.body.leaveType.id,
    startDate: excessDates[0],
    endDate: excessDates[14],
    reason: 'Exceeds annual quota',
  })
  assert.equal(excessLeave.status, 422)

  assert.equal((await call('post', `/api/leave/${leaveCreate.body.leave.id}/approve`, adminToken, { comment: 'forbidden' })).status, 403)
  const approvedLeave = await call('post', `/api/leave/${leaveCreate.body.leave.id}/approve`, hrToken, { comment: 'approved for test' })
  assert.equal(approvedLeave.status, 200, JSON.stringify(approvedLeave.body))
  const balance = await call('get', '/api/leave/balance', employee1Token)
  assert.equal(balance.status, 200)
  assert.equal(balance.body.leaveTypes.find((type) => type.id === annual.body.leaveType.id).used, 4)
  assert.equal(await call('post', `/api/leave/${leaveCreate.body.leave.id}/cancel`, employee1Token, {}).then((response) => response.status), 409)
  const leaveBoard = await call('get', `/api/attendance/board?date=${leaveDates[0]}`, hrToken)
  assert.equal(leaveBoard.status, 200)
  assert.equal(leaveBoard.body.employees.find((employee) => employee.employeeId === employee1Id).status, 'on_leave')
  assert.equal((await call('delete', `/api/settings/leave-types/${annual.body.leaveType.id}`, adminToken)).status, 409)
  assert.equal((await call('delete', `/api/settings/departments/${dept.body.department.id}`, adminToken)).status, 409)
  assert.equal((await call('delete', `/api/settings/designations/${designation.body.designation.id}`, adminToken)).status, 409)
  assert.equal((await call('patch', '/api/settings/company', adminToken, {
    weekend: testWeekend,
  })).status, 200)

  const month = today.slice(0, 7)
  const payrollDraft = await call('post', '/api/payroll/runs', hrToken, { month })
  assert.equal(payrollDraft.status, 201, JSON.stringify(payrollDraft.body))
  assert.equal(payrollDraft.body.items.length, 2)
  const duplicateDraft = await call('post', '/api/payroll/runs', hrToken, { month })
  assert.equal(duplicateDraft.status, 409)
  const regenerated = await call('post', '/api/payroll/runs', hrToken, { month, regenerate: true })
  assert.equal(regenerated.status, 200)
  assert.equal((await call('post', `/api/payroll/runs/${regenerated.body.run.id}/finalize`, hrToken, {})).status, 403)
  const finalized = await call('post', `/api/payroll/runs/${regenerated.body.run.id}/finalize`, adminToken, {})
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body))
  assert.equal(finalized.body.run.status, 'finalized')
  assert.equal(await call('post', '/api/payroll/runs', hrToken, { month, regenerate: true }).then((response) => response.status), 409)
  assert.equal(await PayrollRun.countDocuments({ month, status: 'finalized' }), 1)
  const runItems = await PayrollItem.find({ run: regenerated.body.run.id }).lean()
  assert.equal(runItems.length, 2)
  const employee1Item = runItems.find((item) => item.employee.toString() === employee1Id)
  const employee2Item = runItems.find((item) => item.employee.toString() === employee2Id)
  assert.ok(employee1Item)
  assert.ok(employee2Item)
  const myPayslips = await call('get', '/api/payroll/payslips/my', employee1Token)
  assert.equal(myPayslips.status, 200)
  assert.equal(myPayslips.body.payslips.length, 1)
  assert.equal(myPayslips.body.payslips[0].basic, employee1Item.basic)
  const employeePdf = await call('get', `/api/payroll/payslips/${employee1Item._id}/pdf`, employee1Token)
  assert.equal(employeePdf.status, 200)
  assert.match(employeePdf.headers['content-type'], /application\/pdf/)
  assert.equal(employeePdf.body.subarray(0, 4).toString(), '%PDF')
  assert.equal((await call('get', `/api/payroll/payslips/${employee2Item._id}/pdf`, employee1Token)).status, 403)
  assert.equal((await call('get', `/api/payroll/runs/${regenerated.body.run.id}`, employee1Token)).status, 403)
  assert.equal((await call('get', `/api/payroll/payslips/${employee2Item._id}/pdf`, hrToken)).status, 200)
  assert.equal(await Notification.countDocuments({ user: employee1Login.user.id, title: 'Payslip available' }), 1)

  const dateFrom = `${month}-01`
  const hrDashboard = await call('get', `/api/dashboard/hr?from=${dateFrom}&to=${today}`, hrToken)
  assert.equal(hrDashboard.status, 200, JSON.stringify(hrDashboard.body))
  assert.equal(hrDashboard.body.headcount, 2)
  assert.equal(hrDashboard.body.presentToday, 1)
  assert.equal(hrDashboard.body.lateToday, 1)
  assert.equal(hrDashboard.body.onLeaveToday, 0)
  const todayTrend = hrDashboard.body.attendanceTrend.find((day) => day.date === today)
  assert.ok(todayTrend, 'today must appear in the working-day attendance trend')
  assert.equal(todayTrend.attendanceRate, 100)
  assert.equal(todayTrend.present, 1)
  assert.equal(todayTrend.late, 1)
  const adminDashboard = await call('get', `/api/dashboard/admin?from=${dateFrom}&to=${today}`, adminToken)
  assert.equal(adminDashboard.status, 200, JSON.stringify(adminDashboard.body))
  assert.equal(adminDashboard.body.headcount, 2)
  const expectedGross = runItems.reduce((sum, item) => sum + item.gross, 0)
  const expectedNet = runItems.reduce((sum, item) => sum + item.netPay, 0)
  assert.equal(adminDashboard.body.payrollCost.gross, expectedGross)
  assert.equal(adminDashboard.body.payrollCost.net, expectedNet)
  assert.equal((await call('get', `/api/dashboard/admin?from=${dateFrom}&to=${today}`, hrToken)).status, 403)
  const employeeDashboard = await call('get', '/api/dashboard/employee', employee1Token)
  assert.equal(employeeDashboard.status, 200)
  assert.equal(Object.hasOwn(employeeDashboard.body, 'headcount'), false)
  assert.equal(JSON.stringify(employeeDashboard.body).includes('basicSalary'), false)
  assert.equal((await call('get', '/api/attendance/my?month=not-a-month', employee1Token)).status, 400)

  const announcement = await call('post', '/api/announcements', hrToken, {
    title: 'Demo notice',
    message: 'The database-backed announcement is visible on dashboards.',
  })
  assert.equal(announcement.status, 201)
  assert.equal((await call('get', '/api/announcements', employee1Token)).body.announcements[0].title, 'Demo notice')
  assert.equal((await call('get', '/api/dashboard/employee', employee1Token)).body.announcements[0].id, announcement.body.announcement.id)

  const validCsv = [
    'code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary',
    `CSV001,CSV Imported,csv@example.test,03005555555,CSV Street,other,Engineering,Engineer,${joinDate},active,,85000`,
  ].join('\n')
  const invalidCsv = [
    'code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary',
    `BAD001,Invalid Row,not-an-email,03005555555,CSV Street,other,Missing,Engineer,${joinDate},active,,-2`,
  ].join('\n')
  const dryRun = await call('post', '/api/employees/import?dryRun=true', hrToken, { csv: invalidCsv })
  assert.equal(dryRun.status, 200)
  assert.equal(dryRun.body.validRows, 0)
  assert.ok(dryRun.body.errors.some((issue) => issue.field === 'email'))
  assert.ok(dryRun.body.errors.some((issue) => issue.field === 'department'))
  assert.ok(dryRun.body.errors.some((issue) => issue.field === 'basicSalary'))
  const csvImport = await call('post', '/api/employees/import?dryRun=false', hrToken, { csv: validCsv })
  assert.equal(csvImport.status, 201, JSON.stringify(csvImport.body))
  assert.equal(csvImport.body.created, 1)
  assert.equal(csvImport.body.credentials.length, 1)
  assert.ok(csvImport.body.credentials[0].temporaryPassword)
  assert.equal((await call('get', '/api/employees/export', hrToken)).headers['content-type'].includes('text/csv'), true)

  const importedLogin = await login('csv@example.test', csvImport.body.credentials[0].temporaryPassword)
  const importedEmployeeId = importedLogin.user.employeeId
  const deactivate = await call('patch', `/api/employees/${importedEmployeeId}/login`, hrToken, { isActive: false })
  assert.equal(deactivate.status, 200)
  assert.equal((await call('get', '/api/auth/me', importedLogin.token)).status, 401)
  assert.equal((await call('get', '/api/audit-logs', hrToken)).status, 403)
  const auditLogs = await call('get', '/api/audit-logs?page=1&pageSize=100', adminToken)
  assert.equal(auditLogs.status, 200, JSON.stringify(auditLogs.body))
  assert.ok(auditLogs.body.entries.some((entry) => entry.action === 'finalize' && entry.entityType === 'PayrollRun'))
  assert.ok(auditLogs.body.entries.some((entry) => entry.action === 'leave-approved'))
  assert.ok(auditLogs.body.entries.some((entry) => entry.action === 'correction-approved'))
  assert.ok(auditLogs.body.entries.some((entry) => entry.action === 'salary-change'))
  assert.equal(JSON.stringify(await AuditLog.find().lean()).includes(firstCreate.body.temporaryPassword), false)
  assert.equal(JSON.stringify(await AuditLog.find().lean()).includes('passwordHash'), false)

  const mockResponses = []
  let sawOwnScopeToolResult = false
  aiService.setAiClientForTesting({
    models: {
      generateContent: async (options) => {
        const response = mockResponses.shift()
        if (response?.inspectOwnScope) {
          const lastPart = options.contents.at(-1)?.parts?.[0]
          const result = lastPart?.functionResponse?.response?.result
          sawOwnScopeToolResult = result?.employees?.length === 0
          assert.equal(JSON.stringify(result).includes('two@example.test'), false)
        }
        return response?.response || response
      },
    },
  })
  mockResponses.push({
    functionCalls: [{
      name: 'search_employees',
      args: { search: 'two@example.test', limit: 5 },
    }],
    candidates: [{
      content: { role: 'model', parts: [{ functionCall: { name: 'search_employees' } }] },
    }],
  }, { inspectOwnScope: true, response: { text: 'No matching profile in your own records.' } })
  const scopedAi = await call('post', '/api/ai/chat', employee1Token, {
    message: 'Search for two@example.test',
  })
  assert.equal(scopedAi.status, 200)
  assert.equal(scopedAi.body.aiGenerated, true)
  assert.equal(sawOwnScopeToolResult, true)
  assert.equal(scopedAi.body.reply.includes('two@example.test'), false)
  const salaryRefusal = await call('post', '/api/ai/chat', employee1Token, {
    message: 'Tell me my colleague salary',
  })
  assert.equal(salaryRefusal.status, 200)
  assert.match(salaryRefusal.body.reply, /only help with your own/i)
  assert.equal(salaryRefusal.body.aiGenerated, true)

  mockResponses.push({ text: JSON.stringify({ bullets: [
    'The dashboard data is available.',
    'Attendance and leave metrics are current.',
    'Payroll is included in the selected period.',
  ] }) })
  const summary = await call('post', '/api/ai/dashboard-summary', adminToken, {
    kpis: adminDashboard.body,
    filters: { from: dateFrom, to: today },
  })
  assert.equal(summary.status, 200)
  assert.equal(summary.body.summary.bullets.length, 3)
  assert.equal(summary.body.aiGenerated, true)

  mockResponses.push({ text: JSON.stringify({
    type: annual.body.leaveType.id,
    start: leaveDates[0],
    end: leaveDates[1],
    reason: 'Family event',
  }) })
  const smartLeave = await call('post', '/api/ai/smart-leave', employee1Token, {
    text: 'Please suggest leave for a family event',
  })
  assert.equal(smartLeave.status, 200)
  assert.equal(smartLeave.body.suggestion.type, annual.body.leaveType.id)
  assert.equal(smartLeave.body.aiGenerated, true)

  await AiRequestWindow.deleteMany({ user: employee1Login.user.id })
  mockResponses.push(...Array.from({ length: 20 }, () => ({ text: 'Hello.' })))
  for (let index = 0; index < 20; index += 1) {
    const limitedRequest = await call('post', '/api/ai/chat', employee1Token, { message: `Test ${index}` })
    assert.equal(limitedRequest.status, 200, JSON.stringify(limitedRequest.body))
  }
  const overLimit = await call('post', '/api/ai/chat', employee1Token, { message: 'One too many' })
  assert.equal(overLimit.status, 429)
  assert.ok(await AiLog.countDocuments({ user: employee1Login.user.id }))
  assert.ok(await AiLog.countDocuments({ user: employee1Login.user.id, status: 'rate_limited' }))
  const storedAiLogs = JSON.stringify(await AiLog.find({ user: employee1Login.user.id }).lean())
  assert.equal(storedAiLogs.includes(process.env.AI_API_KEY), false)

  const badLogin = { email: 'invalid-login@example.test', password: crypto.randomBytes(24).toString('base64url') }
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await call('post', '/api/auth/login', null, badLogin)).status, 401)
  }
  assert.equal((await call('post', '/api/auth/login', null, badLogin)).status, 429)

  assert.equal(await Employee.countDocuments(), 3)
  assert.equal(await LeaveRequest.countDocuments({ status: 'approved' }), 1)
  assert.equal(await PayrollRun.countDocuments({ status: 'finalized' }), 1)

  const validMongoUri = process.env.MONGO_URI
  await mongoose.disconnect()
  process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unavailable'
  const unavailable = await request(app).get('/api/health')
  assert.equal(unavailable.status, 503)
  assert.match(unavailable.body.message, /Database is temporarily unavailable/)
  process.env.MONGO_URI = validMongoUri
  const recovered = await request(app).get('/api/health')
  assert.equal(recovered.status, 200, JSON.stringify(recovered.body))
})
