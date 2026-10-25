const auditService = require('../services/audit.service')

const listAuditLogs = async (req, res) => {
  res.status(200).json(await auditService.listAuditLogs(req.validatedQuery))
}

module.exports = { listAuditLogs }