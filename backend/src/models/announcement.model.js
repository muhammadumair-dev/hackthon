const mongoose = require('mongoose')

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postedByRole: { type: String, required: true, enum: ['admin', 'hr'] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
)

announcementSchema.index({ createdAt: -1, _id: -1 })

module.exports = mongoose.model('Announcement', announcementSchema)