const payrollService = require('../services/payroll.service')

const createRun = async (req, res) => {
  const result = await payrollService.createOrRegenerateRun(
    req.user,
    req.body.month,
    req.body.regenerate,
  )
  res.status(result.created ? 201 : 200).json({
    run: result.run,
    items: result.items,
  })
}

const listRuns = async (req, res) => {
  res.status(200).json({ runs: await payrollService.listRuns() })
}

const getRun = async (req, res) => {
  res.status(200).json(await payrollService.getRun(req.validatedParams.id))
}

const finalizeRun = async (req, res) => {
  res.status(200).json({
    run: await payrollService.finalizeRun(req.validatedParams.id, req.user),
  })
}

const getMyPayslips = async (req, res) => {
  res.status(200).json({ payslips: await payrollService.getMyPayslips(req.user) })
}

const downloadPayslip = async (req, res) => {
  const { filename, buffer } = await payrollService.getPayslipPdf(
    req.validatedParams.id,
    req.user,
  )
  res
    .status(200)
    .type('application/pdf')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buffer)
}

module.exports = {
  createRun,
  listRuns,
  getRun,
  finalizeRun,
  getMyPayslips,
  downloadPayslip,
}
