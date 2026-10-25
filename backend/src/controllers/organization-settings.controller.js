const organizationSettings = require('../services/organization-settings.service')
const Company = require('../models/company.model')
const User = require('../models/user.model')
const { logAction } = require('../services/audit.service')

const getCompany = async (req, res) => {
  res.status(200).json({ company: await organizationSettings.getCompanySettings() })
}

const updateCompany = async (req, res) => {
  const before = await Company.findById('primary').lean()
  const company = await organizationSettings.updateCompanySettings(req.body)
  await logAction({
    actor: req.user,
    action: 'update',
    entityType: 'Company',
    entityId: 'primary',
    before,
    after: company,
  })
  res.status(200).json({
    company,
  })
}

const listResource = async (req, res) => {
  const config = organizationSettings.resources[req.settingResource]
  res.status(200).json({
    [config.listKey]: await organizationSettings.listResource(req.settingResource),
  })
}

const createResource = async (req, res) => {
  const config = organizationSettings.resources[req.settingResource]
  const record = await organizationSettings.createResource(req.settingResource, req.body)
  await logAction({
    actor: req.user,
    action: 'create',
    entityType: config.modelName,
    entityId: record.id,
    after: record,
  })
  res.status(201).json({ [config.responseKey]: record })
}

const updateResource = async (req, res) => {
  const config = organizationSettings.resources[req.settingResource]
  const before = await config.Model.findById(req.params.id).lean()
  const record = await organizationSettings.updateResource(
    req.settingResource,
    req.params.id,
    req.body,
  )
  await logAction({
    actor: req.user,
    action: 'update',
    entityType: config.modelName,
    entityId: record.id,
    before,
    after: record,
  })
  res.status(200).json({ [config.responseKey]: record })
}

const deleteResource = async (req, res) => {
  const config = organizationSettings.resources[req.settingResource]
  const before = await config.Model.findById(req.params.id).lean()
  await organizationSettings.deleteResource(req.settingResource, req.params.id)
  if (before) {
    await logAction({
      actor: req.user,
      action: 'delete',
      entityType: config.modelName,
      entityId: req.params.id,
      before,
    })
  }
  const labels = {
    departments: 'Department',
    designations: 'Designation',
    'leave-types': 'Leave type',
    holidays: 'Holiday',
  }
  res.status(200).json({ message: `${labels[req.settingResource]} deleted.` })
}

const listHrUsers = async (req, res) => {
  res.status(200).json({ hrUsers: await organizationSettings.listHrUsers() })
}

const createHrUser = async (req, res) => {
  const result = await organizationSettings.createHrUser(req.body)
  await logAction({
    actor: req.user,
    action: 'create',
    entityType: 'User',
    entityId: result.hrUser.id,
    after: result.hrUser,
  })
  res.status(201).json(result)
}

const updateHrUserStatus = async (req, res) => {
  const before = await User.findOne({ _id: req.params.id, role: 'hr' })
    .select('name email role isActive mustChangePassword')
    .lean()
  const hrUser = await organizationSettings.updateHrUserStatus(req.params.id, req.body.isActive)
  await logAction({
    actor: req.user,
    action: 'deactivate',
    entityType: 'User',
    entityId: req.params.id,
    before,
    after: hrUser,
  })
  res.status(200).json({
    hrUser,
  })
}

const resetHrUserPassword = async (req, res) => {
  const before = await User.findOne({ _id: req.params.id, role: 'hr' })
    .select('name email role isActive mustChangePassword')
    .lean()
  const result = await organizationSettings.resetHrUserPassword(req.params.id)
  await logAction({
    actor: req.user,
    action: 'reset-password',
    entityType: 'User',
    entityId: req.params.id,
    before,
    after: result.hrUser,
  })
  res.status(200).json(result)
}

module.exports = {
  getCompany,
  updateCompany,
  listResource,
  createResource,
  updateResource,
  deleteResource,
  listHrUsers,
  createHrUser,
  updateHrUserStatus,
  resetHrUserPassword,
}
