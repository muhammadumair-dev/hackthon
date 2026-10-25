const Announcement = require('../models/announcement.model')
const AppError = require('../utils/app-error')
const { logAction } = require('./audit.service')

const serialize = (announcement) => ({
  id: announcement._id.toString(),
  title: announcement.title,
  message: announcement.message,
  postedBy: announcement.postedBy?._id
    ? {
        id: announcement.postedBy._id.toString(),
        name: announcement.postedBy.name,
        role: announcement.postedByRole,
      }
    : announcement.postedBy?.toString() || null,
  createdAt: announcement.createdAt.toISOString(),
})

const listAnnouncements = async (limit = 20) => {
  const announcements = await Announcement.find()
    .populate('postedBy', 'name')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
  return announcements.map(serialize)
}

const createAnnouncement = async (user, data) => {
  if (!['admin', 'hr'].includes(user.role)) {
    throw new AppError(403, 'Only Admin or HR can post announcements.')
  }
  const [announcement] = await Announcement.create([{
    title: data.title,
    message: data.message,
    postedBy: user._id,
    postedByRole: user.role,
  }])
  const populated = await Announcement.findById(announcement._id)
    .populate('postedBy', 'name')
    .lean()
  const result = serialize(populated)
  await logAction({
    actor: user,
    action: 'create',
    entityType: 'Announcement',
    entityId: result.id,
    after: result,
  })
  return result
}

module.exports = { listAnnouncements, createAnnouncement }