const mongoose = require('mongoose')
const Notification = require('../models/notification.model')
const AppError = require('../utils/app-error')

const serializeNotification = (notification) => ({
  id: notification._id.toString(),
  title: notification.title,
  message: notification.message,
  isRead: notification.isRead,
  createdAt: notification.createdAt.toISOString(),
})

const listNotifications = async (user) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: user._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean(),
    Notification.countDocuments({ user: user._id, isRead: false }),
  ])
  return { unreadCount, notifications: notifications.map(serializeNotification) }
}

const markAsRead = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Notification id is invalid.')
  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: user._id },
    { $set: { isRead: true } },
    { returnDocument: 'after', runValidators: true },
  ).lean()
  if (!notification) throw new AppError(404, 'Notification was not found.')
  return serializeNotification(notification)
}

module.exports = { listNotifications, markAsRead }
