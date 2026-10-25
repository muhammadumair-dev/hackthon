const analyticsService = require('../services/analytics.service')

const getHrDashboard = async (req, res) => {
  res.status(200).json(await analyticsService.getHrDashboard(req.user, req.validatedQuery))
}

const getAdminDashboard = async (req, res) => {
  res.status(200).json(await analyticsService.getAdminDashboard(req.user, req.validatedQuery))
}

const getEmployeeDashboard = async (req, res) => {
  res.status(200).json(await analyticsService.getEmployeeDashboard(req.user))
}

module.exports = {
  getHrDashboard,
  getAdminDashboard,
  getEmployeeDashboard,
}
