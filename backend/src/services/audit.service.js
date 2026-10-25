const AuditLog = require('../models/audit-log.model')

const REDACTED = '[redacted]'
const SENSITIVE_KEY = /(password|passwd|hash|token|secret|api.?key|credential)/i

const sanitize = (value) => {
  if (value === null || value === undefined) return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value !== 'object') return value

  const source = typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true, virtuals: false })
    : value
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitize(item),
    ]),
  )
}

const logAction = async ({ actor, action, entityType, entityId, before = null, after = null }) => {
  const actorId = actor?._id || actor?.id || actor
  const actorRole = actor?.role
  if (!actorId || !actorRole) {
    throw new TypeError('Audit entries require an actor id and role.')
  }
  await AuditLog.create({
    actor: actorId,
    actorRole,
    action,
    entityType,
    entityId: entityId?.toString() || null,
    before: sanitize(before),
    after: sanitize(after),
  })
}

const listAuditLogs = async ({ action, entityType, actor, from, to, page = 1, pageSize = 20 }) => {
  const filter = {}
  if (action) filter.action = action
  if (entityType) filter.entityType = entityType
  if (actor) filter.actor = actor
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditLog.countDocuments(filter),
  ])
  return {
    entries: entries.map((entry) => ({
      id: entry._id.toString(),
      actor: entry.actor
        ? {
            id: entry.actor._id.toString(),
            name: entry.actor.name,
            email: entry.actor.email,
            role: entry.actor.role,
          }
        : null,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      createdAt: entry.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

module.exports = { logAction, listAuditLogs }