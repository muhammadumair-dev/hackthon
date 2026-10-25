const attendanceService = require('../services/attendance.service')

const checkIn = async (req, res) => {
  res.status(201).json(await attendanceService.checkIn(req.user))
}

const checkOut = async (req, res) => {
  res.status(200).json(await attendanceService.checkOut(req.user))
}

const getMyAttendance = async (req, res) => {
  res.status(200).json(await attendanceService.getMyAttendance(req.user, req.validatedQuery.month))
}

const getAttendanceBoard = async (req, res) => {
  res.status(200).json(await attendanceService.getAttendanceBoard(req.validatedQuery))
}

const requestCorrection = async (req, res) => {
  res.status(201).json({
    correction: await attendanceService.requestCorrection(req.user, req.body),
  })
}

const listCorrections = async (req, res) => {
  res.status(200).json({
    corrections: await attendanceService.listCorrections(req.user),
  })
}

const approveCorrection = async (req, res) => {
  res.status(200).json({
    correction: await attendanceService.reviewCorrection(
      req.params.id,
      req.user,
      'approved',
      req.body.comment,
    ),
  })
}

const rejectCorrection = async (req, res) => {
  res.status(200).json({
    correction: await attendanceService.reviewCorrection(
      req.params.id,
      req.user,
      'rejected',
      req.body.comment,
    ),
  })
}

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendanceBoard,
  requestCorrection,
  listCorrections,
  approveCorrection,
  rejectCorrection,
}
