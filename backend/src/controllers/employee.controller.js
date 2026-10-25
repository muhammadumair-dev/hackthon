const employeeService = require('../services/employee.service')
const Employee = require('../models/employee.model')
const User = require('../models/user.model')
const { logAction } = require('../services/audit.service')

const listEmployees = async (req, res) => {
  const { search = '', department, status, page, pageSize } = req.validatedQuery
  res.status(200).json(await employeeService.listEmployees({
    search,
    department,
    status,
    page,
    pageSize,
  }))
}

const createEmployee = async (req, res) => {
  const result = await employeeService.createEmployee(req.body)
  await logAction({
    actor: req.user,
    action: 'register',
    entityType: 'Employee',
    entityId: result.employee.id,
    after: result.employee,
  })
  res.status(201).json(result)
}

const getEmployee = async (req, res) => {
  res.status(200).json({
    employee: await employeeService.getEmployeeById(req.params.id, req.user),
  })
}

const getMyEmployee = async (req, res) => {
  res.status(200).json({
    employee: await employeeService.getMyEmployee(req.user),
  })
}

const updateEmployee = async (req, res) => {
  const before = req.user.role === 'hr'
    ? await Employee.findById(req.params.id).lean()
    : null
  const employee = await employeeService.updateEmployee(req.params.id, req.body, req.user)
  if (req.user.role === 'hr') {
    await logAction({
      actor: req.user,
      action: 'update',
      entityType: 'Employee',
      entityId: employee.id,
      before,
      after: employee,
    })
    if (before?.basicSalary !== employee.basicSalary) {
      await logAction({
        actor: req.user,
        action: 'salary-change',
        entityType: 'Employee',
        entityId: employee.id,
        before: { basicSalary: before.basicSalary },
        after: { basicSalary: employee.basicSalary },
      })
    }
  }
  res.status(200).json({
    employee,
  })
}

const updateMyEmployee = async (req, res) => {
  const employee = await employeeService.getMyEmployee(req.user)
  const before = await Employee.findById(employee.id).lean()
  const updated = await employeeService.updateEmployee(employee.id, req.body, req.user)
  await logAction({
    actor: req.user,
    action: 'update-own-profile',
    entityType: 'Employee',
    entityId: employee.id,
    before: { phone: before.phone, address: before.address },
    after: { phone: updated.phone, address: updated.address },
  })
  res.status(200).json({
    employee: updated,
  })
}

const exportEmployees = async (req, res) => {
  const { search = '', department, status } = req.validatedQuery
  const csv = await employeeService.exportEmployees({ search, department, status })
  res
    .status(200)
    .type('text/csv')
    .set('Content-Disposition', 'attachment; filename="hcm-employees.csv"')
    .send(csv)
}

const importEmployees = async (req, res) => {
  const { dryRun: dryRunValue } = req.validatedQuery
  const result = await employeeService.importEmployees(req.body.csv, dryRunValue === 'true')
  if (dryRunValue === 'false') {
    await Promise.all((result.employees || []).map((employee) => logAction({
      actor: req.user,
      action: 'import',
      entityType: 'Employee',
      entityId: employee.id,
      after: employee,
    })))
  }
  if (dryRunValue === 'false' && result.errors?.length) {
    return res.status(422).json(result)
  }
  return res.status(dryRunValue === 'true' ? 200 : 201).json(result)
}

const updateEmployeeLoginStatus = async (req, res) => {
  const before = await User.findOne({ employeeId: req.params.id, role: 'employee' })
    .select('name email role isActive mustChangePassword')
    .lean()
  const user = await employeeService.updateEmployeeLoginStatus(req.params.id, req.body.isActive)
  await logAction({
    actor: req.user,
    action: 'deactivate',
    entityType: 'User',
    entityId: user.id,
    before,
    after: user,
  })
  res.status(200).json({ user })
}

const resetEmployeePassword = async (req, res) => {
  const before = await User.findOne({ employeeId: req.params.id, role: 'employee' })
    .select('name email role isActive mustChangePassword')
    .lean()
  const result = await employeeService.resetEmployeePassword(req.params.id)
  await logAction({
    actor: req.user,
    action: 'reset-password',
    entityType: 'User',
    entityId: result.user.id,
    before,
    after: result.user,
  })
  res.status(200).json(result)
}

module.exports = {
  listEmployees,
  createEmployee,
  getEmployee,
  getMyEmployee,
  updateEmployee,
  updateMyEmployee,
  exportEmployees,
  importEmployees,
  updateEmployeeLoginStatus,
  resetEmployeePassword,
}
