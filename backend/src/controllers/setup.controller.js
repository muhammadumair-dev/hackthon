const {
  getSetupStatus,
  createInitialCompanyAndAdmin,
} = require('../services/setup.service')

const setupStatus = async (req, res) => {
  res.status(200).json(await getSetupStatus())
}

const createSetup = async (req, res) => {
  const result = await createInitialCompanyAndAdmin(req.body)
  res.status(201).json(result)
}

module.exports = { setupStatus, createSetup }
