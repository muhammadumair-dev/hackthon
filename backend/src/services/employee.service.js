const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const mongoose = require('mongoose')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Employee = require('../models/employee.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const parseCsv = require('../utils/parse-csv')
const { employeePayloadSchema } = require('../utils/employee-validation')

const csvColumns = [
  'code',
  'name',
  'email',
  'phone',
  'address',
  'gender',
  'department',
  'designation',
  'joinDate',
  'status',
  'exitDate',
  'basicSalary',
]
const requiredCsvColumns = csvColumns.filter((column) => column !== 'exitDate')

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const serializeEmployee = (employee, { includeSalary = true } = {}) => {
  const department = employee.department
  const designation = employee.designation
  const serialized = {
    id: employee._id.toString(),
    code: employee.code,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    gender: employee.gender,
    department: {
      id: department?._id?.toString() || department?.toString(),
      name: department?.name || '',
    },
    designation: {
      id: designation?._id?.toString() || designation?.toString(),
      name: designation?.name || '',
    },
    joinDate: employee.joinDate,
    status: employee.status,
    exitDate: employee.exitDate || null,
  }
  if (includeSalary) {
    serialized.basicSalary = employee.basicSalary
  }
  return serialized
}

const employeeQuery = () => Employee.find({})
  .populate('department', 'name')
  .populate('designation', 'name')

const ensureReferencesExist = async (departmentId, designationId, session) => {
  const departmentQuery = Department.findById(departmentId)
  const designationQuery = Designation.findById(designationId)
  if (session) {
    departmentQuery.session(session)
    designationQuery.session(session)
  }
  const [department, designation] = session
    ? [await departmentQuery, await designationQuery]
    : await Promise.all([departmentQuery, designationQuery])
  if (!department) {
    throw new AppError(400, 'Choose a department that exists.')
  }
  if (!designation) {
    throw new AppError(400, 'Choose a designation that exists.')
  }
}

const createEmployeeAndUser = async (employeeData, session) => {
  await ensureReferencesExist(employeeData.department, employeeData.designation, session)
  const employeeId = new mongoose.Types.ObjectId()
  const temporaryPassword = crypto.randomBytes(18).toString('base64url')
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)

  const [employee] = await Employee.create(
    [{ ...employeeData, _id: employeeId }],
    { session },
  )
  const [user] = await User.create(
    [{
      name: employeeData.name,
      email: employeeData.email,
      passwordHash,
      role: 'employee',
      employeeId: employeeId.toString(),
      isActive: true,
      mustChangePassword: true,
    }],
    { session },
  )

  return {
    employee,
    temporaryPassword,
    user,
  }
}

const createEmployee = async (employeeData) => {
  const session = await mongoose.startSession()
  let created
  try {
    await session.withTransaction(async () => {
      created = await createEmployeeAndUser(employeeData, session)
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'Employee code or email already exists.')
    }
    throw error
  } finally {
    await session.endSession()
  }

  const employee = await Employee.findById(created.employee._id)
    .populate('department', 'name')
    .populate('designation', 'name')
    .lean()
  return {
    employee: serializeEmployee(employee),
    temporaryPassword: created.temporaryPassword,
  }
}

const buildEmployeeFilter = ({ search, department, status }) => {
  const filter = {}
  if (department) {
    if (!mongoose.isValidObjectId(department)) {
      throw new AppError(400, 'Department filter is invalid.')
    }
    filter.department = department
  }
  if (status) {
    filter.status = status
  }
  if (search) {
    const expression = new RegExp(escapeRegex(search.trim()), 'i')
    filter.$or = [
      { name: expression },
      { code: expression },
      { email: expression },
    ]
  }
  return filter
}

const listEmployees = async ({ search = '', department, status, page, pageSize }) => {
  const filter = buildEmployeeFilter({ search, department, status })
  const total = await Employee.countDocuments(filter)
  const records = await employeeQuery()
    .find(filter)
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()

  return {
    employees: records.map((record) => serializeEmployee(record)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

const getEmployeeById = async (id, user) => {
  if (user.role === 'employee' && user.employeeId !== id) {
    throw new AppError(403, 'You are not allowed to access another employee record.')
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Employee id is invalid.')
  }

  const employee = await Employee.findById(id)
    .populate('department', 'name')
    .populate('designation', 'name')
    .lean()
  if (!employee) {
    throw new AppError(404, 'Employee was not found.')
  }
  return serializeEmployee(employee, { includeSalary: user.role !== 'employee' })
}

const getMyEmployee = async (user) => {
  if (user.role !== 'employee' || !user.employeeId) {
    throw new AppError(403, 'This account is not linked to an employee profile.')
  }
  return getEmployeeById(user.employeeId, user)
}

const updateEmployee = async (id, updates, user) => {
  if (user.role === 'employee') {
    if (user.employeeId !== id) {
      throw new AppError(403, 'You are not allowed to edit another employee record.')
    }
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, 'Employee id is invalid.')
    }
    const employee = await Employee.findByIdAndUpdate(
      id,
      { $set: { phone: updates.phone, address: updates.address } },
      { returnDocument: 'after', runValidators: true },
    )
    if (!employee) {
      throw new AppError(404, 'Employee was not found.')
    }
    return getEmployeeById(id, user)
  }

  if (user.role !== 'hr') {
    throw new AppError(403, 'Only HR can edit employee records.')
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Employee id is invalid.')
  }

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await ensureReferencesExist(updates.department, updates.designation, session)
      const employee = await Employee.findByIdAndUpdate(
        id,
        { $set: updates },
        { returnDocument: 'after', runValidators: true, session },
      )
      if (!employee) {
        throw new AppError(404, 'Employee was not found.')
      }

      const userUpdate = await User.updateOne(
        { employeeId: id, role: 'employee' },
        { $set: { name: updates.name, email: updates.email } },
        { runValidators: true, session },
      )
      if (userUpdate.matchedCount === 0) {
        throw new AppError(409, 'Employee login was not found; update was not saved.')
      }
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'Employee code or email already exists.')
    }
    throw error
  } finally {
    await session.endSession()
  }
  return getEmployeeById(id, user)
}

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const exportEmployees = async (filters) => {
  const filter = buildEmployeeFilter(filters)
  const records = await employeeQuery().find(filter).sort({ name: 1, _id: 1 }).lean()
  const rows = [csvColumns]

  for (const record of records) {
    rows.push([
      record.code,
      record.name,
      record.email,
      record.phone,
      record.address,
      record.gender,
      record.department?.name || '',
      record.designation?.name || '',
      record.joinDate,
      record.status,
      record.exitDate || '',
      record.basicSalary,
    ])
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

const parseAndValidateCsv = async (csv) => {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''))
  const headers = rows[0].map((header) => header.trim())
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeaders.length) {
    throw new AppError(400, `CSV contains duplicate column: ${duplicateHeaders[0]}.`)
  }

  const missingHeaders = requiredCsvColumns.filter((column) => !headers.includes(column))
  if (missingHeaders.length) {
    throw new AppError(400, `CSV is missing required column: ${missingHeaders[0]}.`)
  }

  const errors = []
  const candidateRows = []
  const departmentNames = new Set()
  const designationNames = new Set()
  const rawRows = rows.slice(1)

  if (rawRows.length > 1000) {
    throw new AppError(400, 'CSV import is limited to 1000 employee rows at a time.')
  }
  if (rawRows.length === 0) {
    throw new AppError(400, 'CSV must contain at least one employee row.')
  }

  for (let index = 0; index < rawRows.length; index += 1) {
    const rowNumber = index + 2
    const values = rawRows[index]
    if (values.length !== headers.length) {
      errors.push({
        row: rowNumber,
        field: 'row',
        reason: `Expected ${headers.length} columns but found ${values.length}.`,
      })
      continue
    }
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]))

    const rowErrorsBefore = errors.length
    for (const required of ['code', 'name', 'email', 'phone', 'address', 'gender', 'department', 'designation', 'joinDate', 'status', 'basicSalary']) {
      if (!row[required]) {
        errors.push({ row: rowNumber, field: required, reason: 'This field is required.' })
      }
    }

    const basicSalary = Number(row.basicSalary)
    const candidate = {
      ...row,
      basicSalary,
      department: row.department,
      designation: row.designation,
      exitDate: row.exitDate || null,
    }
    const partialValidation = employeePayloadSchema.safeParse({
      ...candidate,
      department: new mongoose.Types.ObjectId().toString(),
      designation: new mongoose.Types.ObjectId().toString(),
    })
    if (!partialValidation.success) {
      for (const issue of partialValidation.error.issues) {
        const field = String(issue.path[0] || 'row')
        errors.push({ row: rowNumber, field, reason: issue.message })
      }
    }

    if (row.department) departmentNames.add(row.department.toLowerCase())
    if (row.designation) designationNames.add(row.designation.toLowerCase())
    candidateRows.push({
      rowNumber,
      candidate,
      isValid: errors.length === rowErrorsBefore,
    })
  }

  const [departments, designations] = await Promise.all([
    Department.find({ name: { $in: [...departmentNames] } }).collation({ locale: 'en', strength: 2 }).lean(),
    Designation.find({ name: { $in: [...designationNames] } }).collation({ locale: 'en', strength: 2 }).lean(),
  ])
  const departmentByName = new Map(departments.map((item) => [item.name.toLowerCase(), item._id.toString()]))
  const designationByName = new Map(designations.map((item) => [item.name.toLowerCase(), item._id.toString()]))
  const resolvedRows = []

  for (const { rowNumber, candidate, isValid } of candidateRows) {
    const department = candidate.department
      ? departmentByName.get(candidate.department.toLowerCase())
      : null
    const designation = candidate.designation
      ? designationByName.get(candidate.designation.toLowerCase())
      : null
    if (candidate.department && !department) {
      errors.push({ row: rowNumber, field: 'department', reason: 'Department does not exist.' })
    }
    if (candidate.designation && !designation) {
      errors.push({ row: rowNumber, field: 'designation', reason: 'Designation does not exist.' })
    }
    if (isValid && department && designation) {
      resolvedRows.push({
        rowNumber,
        data: { ...candidate, department, designation },
      })
    }
  }

  const codeRows = new Map()
  const emailRows = new Map()
  for (const { rowNumber, data } of resolvedRows) {
    const code = data.code.toLowerCase()
    const email = data.email.toLowerCase()
    if (codeRows.has(code)) {
      const firstRow = codeRows.get(code)
      errors.push({ row: firstRow, field: 'code', reason: `Duplicate code in CSV (row ${rowNumber}).` })
      errors.push({ row: rowNumber, field: 'code', reason: `Duplicate code in CSV (row ${firstRow}).` })
    } else {
      codeRows.set(code, rowNumber)
    }
    if (emailRows.has(email)) {
      const firstRow = emailRows.get(email)
      errors.push({ row: firstRow, field: 'email', reason: `Duplicate email in CSV (row ${rowNumber}).` })
      errors.push({ row: rowNumber, field: 'email', reason: `Duplicate email in CSV (row ${firstRow}).` })
    } else {
      emailRows.set(email, rowNumber)
    }
  }

  if (resolvedRows.length) {
    const [existingEmployees, existingUsers] = await Promise.all([
      Employee.find({
        $or: [
          { code: { $in: [...codeRows.keys()] } },
          { email: { $in: [...emailRows.keys()] } },
        ],
      }).collation({ locale: 'en', strength: 2 }).select('code email').lean(),
      User.find({ email: { $in: [...emailRows.keys()] } }).collation({ locale: 'en', strength: 2 }).select('email').lean(),
    ])
    const existingCodes = new Set(existingEmployees.map((employee) => employee.code.toLowerCase()))
    const existingEmails = new Set([
      ...existingEmployees.map((employee) => employee.email.toLowerCase()),
      ...existingUsers.map((user) => user.email.toLowerCase()),
    ])
    for (const { rowNumber, data } of resolvedRows) {
      if (existingCodes.has(data.code.toLowerCase())) {
        errors.push({ row: rowNumber, field: 'code', reason: 'Employee code already exists.' })
      }
      if (existingEmails.has(data.email.toLowerCase())) {
        errors.push({ row: rowNumber, field: 'email', reason: 'Email already exists.' })
      }
    }
  }

  return {
    totalRows: rawRows.length,
    errors: errors.sort((left, right) => left.row - right.row || left.field.localeCompare(right.field)),
    validRows: resolvedRows.filter(
      (row) => !errors.some((error) => error.row === row.rowNumber),
    ),
  }
}

const importEmployees = async (csv, dryRun) => {
  const validation = await parseAndValidateCsv(csv)
  if (dryRun) {
    return {
      dryRun: true,
      totalRows: validation.totalRows,
      validRows: validation.validRows.length,
      errors: validation.errors,
    }
  }

  if (validation.errors.length) {
    return {
      dryRun: false,
      totalRows: validation.totalRows,
      created: 0,
      errors: validation.errors,
    }
  }

  const session = await mongoose.startSession()
  const credentials = []
  const createdEmployeeIds = []
  try {
    await session.withTransaction(async () => {
      credentials.length = 0
      createdEmployeeIds.length = 0
      for (const { data } of validation.validRows) {
        const created = await createEmployeeAndUser(data, session)
        createdEmployeeIds.push(created.employee._id)
        credentials.push({
          employeeId: created.employee._id.toString(),
          email: created.employee.email,
          temporaryPassword: created.temporaryPassword,
        })
      }
    })
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'Employee code or email already exists; no import rows were saved.')
    }
    throw error
  } finally {
    await session.endSession()
  }

  const employees = await employeeQuery()
    .find({ _id: { $in: createdEmployeeIds } })
    .lean()

  return {
    dryRun: false,
    totalRows: validation.totalRows,
    created: employees.length,
    employees: employees.map((employee) => serializeEmployee(employee)),
    credentials,
  }
}

const updateEmployeeLoginStatus = async (id, isActive) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Employee id is invalid.')
  }
  const employee = await Employee.findById(id).select('_id email')
  if (!employee) {
    throw new AppError(404, 'Employee was not found.')
  }
  const user = await User.findOneAndUpdate(
    { employeeId: id, role: 'employee' },
    { $set: { isActive } },
    { returnDocument: 'after', runValidators: true },
  )
  if (!user) {
    throw new AppError(404, 'Employee login was not found.')
  }
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  }
}

const resetEmployeePassword = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Employee id is invalid.')
  }
  const user = await User.findOne({ employeeId: id, role: 'employee' }).select('+passwordHash')
  if (!user) {
    throw new AppError(404, 'Employee login was not found.')
  }
  const temporaryPassword = crypto.randomBytes(18).toString('base64url')
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12)
  user.mustChangePassword = true
  await user.save()
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    temporaryPassword,
  }
}

module.exports = {
  csvColumns,
  serializeEmployee,
  createEmployee,
  listEmployees,
  getEmployeeById,
  getMyEmployee,
  updateEmployee,
  exportEmployees,
  importEmployees,
  updateEmployeeLoginStatus,
  resetEmployeePassword,
}
