const notificationService = require('../services/notification.service')

const listNotifications = async (req, res) => {
  res.status(200).json(await notificationService.listNotifications(req.user))
}

const markAsRead = async (req, res) => {
  res.status(200).json({
    notification: await notificationService.markAsRead(req.user, req.validatedParams.id),
  })
}

module.exports = { listNotifications, markAsRead }
