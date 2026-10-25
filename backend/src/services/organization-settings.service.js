const bcrypt = require('bcryptjs')
const crypto = require('node:crypto')
const mongoose = require('mongoose')
const Company = require('../models/company.model')
const Department = require('../models/department.model')
const Designation = require('../models/designation.model')
const Holiday = require('../models/holiday.model')
const LeaveType = require('../models/leave-type.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')

const resources = {
  departments: { Model: Department, modelName: 'Department', responseKey: 'department', listKey: 'departments' },
  designations: { Model: Designation, modelName: 'Designation', responseKey: 'designation', listKey: 'designations' },
  'leave-types': { Model: LeaveType, modelName: 'LeaveType', responseKey: 'leaveType', listKey: 'leaveTypes' },
  holidays: { Model: Holiday, modelName: 'Holiday', responseKey: 'holiday', listKey: 'holidays' },
}

const serializeCatalogRecord = (resource, record) => {
  const base = { id: record._id.toString() }
  if (resource === 'holidays') {
    return { ...base, date: record.date, name: record.name }
  }
  if (resource === 'leave-types') {
    return {
      ...base,
      name: record.name,
      yearlyQuota: record.isUnlimited ? null : record.yearlyQuota,
      isUnlimited: record.isUnlimited,
      isPaid: record.isPaid,
    }
  }
  return { ...base, name: record.name }
}

const getCompanySettings = async () => {
  let company = await Company.findById('primary').lean()
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed.')
  }

  const defaults = {
    officeStart: '09:00',
    graceMinutes: 15,
    halfDayHours: 5,
    weekend: ['Sat', 'Sun'],
    officeLatitude: null,
    officeLongitude: null,
    radiusMeters: 150,
    timezone: 'Asia/Karachi',
  }
  const missingSettings = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => !Object.hasOwn(company, key)),
  )

  if (Object.keys(missingSettings).length > 0) {
    company = await Company.findByIdAndUpdate(
      'primary',
      { $set: missingSettings },
      { returnDocument: 'after', runValidators: true },
    ).lean()
  }

  return {
    id: company._id,
    name: company.name,
    officeStart: company.officeStart,
    graceMinutes: company.graceMinutes,
    halfDayHours: company.halfDayHours,
    weekend: company.weekend,
    officeLatitude: company.officeLatitude ?? null,
    officeLongitude: company.officeLongitude ?? null,
    radiusMeters: company.radiusMeters,
    timezone: company.timezone || 'Asia/Karachi',
  }
}

const updateCompanySettings = async (updates) => {
  const hasLatitude = Object.hasOwn(updates, 'officeLatitude')
  const hasLongitude = Object.hasOwn(updates, 'officeLongitude')
  if (hasLatitude !== hasLongitude) {
    throw new AppError(400, 'Office latitude and longitude must be provided together.')
  }

  const latitude = hasLatitude ? updates.officeLatitude : undefined
  const longitude = hasLongitude ? updates.officeLongitude : undefined
  if ((latitude === null) !== (longitude === null)) {
    throw new AppError(400, 'Office latitude and longitude must both be set or both be null.')
  }

  const company = await Company.findByIdAndUpdate(
    'primary',
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  )
  if (!company) {
    throw new AppError(404, 'Company setup has not been completed.')
  }

  return getCompanySettings()
}

const listResource = async (resource) => {
  const config = resources[resource]
  const sort = resource === 'holidays' ? { date: 1 } : { name: 1 }
  const records = await config.Model.find({}).sort(sort).lean()
  return records.map((record) => serializeCatalogRecord(resource, record))
}

const createResource = async (resource, data) => {
  const config = resources[resource]
  const record = await config.Model.create(data)
  return serializeCatalogRecord(resource, record)
}

const updateResource = async (resource, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Resource id is invalid.')
  }
  const config = resources[resource]
  const record = await config.Model.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  )
  if (!record) {
    throw new AppError(404, 'Resource was not found.')
  }
  return serializeCatalogRecord(resource, record)
}

const ensureNotInUse = async (targetModelName, id, record) => {
  const mongooseId = new mongoose.Types.ObjectId(id)
  const referenceNames = {
    Department: ['department', 'departmentId', 'departmentIds'],
    Designation: ['designation', 'designationId', 'designationIds'],
    LeaveType: ['leaveType', 'leaveTypeId', 'leaveTypeIds'],
  }
  const conventionalPaths = new Set(referenceNames[targetModelName] || [])

  for (const modelName of mongoose.modelNames()) {
    if (modelName === targetModelName) {
      continue
    }

    const Model = mongoose.model(modelName)
    const referenceChecks = Object.entries(Model.schema.paths)
      .filter(([, schemaType]) => {
        const ref = schemaType.options?.ref
        return (
          ref === targetModelName ||
          ref?.modelName === targetModelName ||
          conventionalPaths.has(schemaType.path)
        )
      })
      .flatMap(([path, schemaType]) => {
        const valueType = schemaType.instance === 'Array'
          ? schemaType.$embeddedSchemaType || schemaType.caster
          : schemaType
        if (valueType.instance === 'ObjectId') {
          return [{ [path]: mongooseId }]
        }
        if (valueType.instance === 'String') {
          return [{ [path]: record.name }, { [path]: id }]
        }
        return [
          { [path]: mongooseId },
          { [path]: record.name },
          { [path]: id },
        ]
      })

    if (!referenceChecks.length) {
      continue
    }

    const referencedRecord = await Model.exists({ $or: referenceChecks })
    if (referencedRecord) {
      throw new AppError(409, 'This item is in use and cannot be deleted.')
    }
  }
}

const deleteResource = async (resource, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'Resource id is invalid.')
  }
  const config = resources[resource]
  const record = await config.Model.findById(id)
  if (!record) {
    throw new AppError(404, 'Resource was not found.')
  }

  if (['departments', 'designations', 'leave-types'].includes(resource)) {
    await ensureNotInUse(config.modelName, id, record)
  }

  await record.deleteOne()
}

const listHrUsers = async () => {
  const users = await User.find({ role: 'hr' })
    .select('name email role isActive mustChangePassword')
    .sort({ name: 1 })
    .lean()
  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  }))
}

const createHrUser = async ({ name, email }) => {
  const temporaryPassword = crypto.randomBytes(18).toString('base64url')
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'hr',
    employeeId: null,
    isActive: true,
    mustChangePassword: true,
  })

  return {
    hrUser: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    temporaryPassword,
  }
}

const updateHrUserStatus = async (id, isActive) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'HR user id is invalid.')
  }
  const user = await User.findOneAndUpdate(
    { _id: id, role: 'hr' },
    { $set: { isActive } },
    { returnDocument: 'after', runValidators: true },
  )
  if (!user) {
    throw new AppError(404, 'HR user was not found.')
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  }
}

const resetHrUserPassword = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'HR user id is invalid.')
  }
  const user = await User.findOne({ _id: id, role: 'hr' }).select('+passwordHash')
  if (!user) {
    throw new AppError(404, 'HR user was not found.')
  }

  const temporaryPassword = crypto.randomBytes(18).toString('base64url')
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12)
  user.mustChangePassword = true
  await user.save()

  return {
    hrUser: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    temporaryPassword,
  }
}

module.exports = {
  resources,
  getCompanySettings,
  updateCompanySettings,
  listResource,
  createResource,
  updateResource,
  deleteResource,
  listHrUsers,
  createHrUser,
  updateHrUserStatus,
  resetHrUserPassword,
}
