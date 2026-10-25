const leaveService = require('../services/leave.service')

const getBalance = async (req, res) => {
  const result = await leaveService.getBalance(req.user)
  res.status(200).json(result)
}

const getWorkdays = async (req, res) => {
  res.status(200).json(await leaveService.getWorkdays(
    req.validatedQuery.startDate,
    req.validatedQuery.endDate,
  ))
}

const createLeave = async (req, res) => {
  res.status(201).json({ leave: await leaveService.createLeave(req.user, req.body) })
}

const getMyLeaves = async (req, res) => {
  res.status(200).json({ leaves: await leaveService.getMyLeaves(req.user) })
}

const cancelLeave = async (req, res) => {
  res.status(200).json({
    leave: await leaveService.cancelLeave(req.user, req.validatedParams.id),
  })
}

const listRequests = async (req, res) => {
  res.status(200).json(await leaveService.listRequests(req.validatedQuery))
}

const approveLeave = async (req, res) => {
  res.status(200).json({
    leave: await leaveService.reviewLeave(
      req.validatedParams.id,
      req.user,
      'approved',
      req.body.comment,
    ),
  })
}

const rejectLeave = async (req, res) => {
  res.status(200).json({
    leave: await leaveService.reviewLeave(
      req.validatedParams.id,
      req.user,
      'rejected',
      req.body.comment,
    ),
  })
}

module.exports = {
  getBalance,
  getWorkdays,
  createLeave,
  getMyLeaves,
  cancelLeave,
  listRequests,
  approveLeave,
  rejectLeave,
}
