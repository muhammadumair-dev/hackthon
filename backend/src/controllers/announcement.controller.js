const announcementService = require('../services/announcement.service')

const listAnnouncements = async (req, res) => {
  res.status(200).json({ announcements: await announcementService.listAnnouncements(5) })
}

const createAnnouncement = async (req, res) => {
  res.status(201).json({
    announcement: await announcementService.createAnnouncement(req.user, req.body),
  })
}

module.exports = { listAnnouncements, createAnnouncement }