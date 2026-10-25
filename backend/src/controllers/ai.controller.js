const aiService = require('../services/ai.service')

const chat = async (req, res) => {
  res.status(200).json(await aiService.chat(req.user, req.body))
}

const dashboardSummary = async (req, res) => {
  res.status(200).json(await aiService.generateDashboardSummary(
    req.user,
    req.body.filters,
  ))
}

const smartLeave = async (req, res) => {
  res.status(200).json(await aiService.smartLeave(req.user, req.body.text))
}

module.exports = {
  chat,
  dashboardSummary,
  smartLeave,
}
