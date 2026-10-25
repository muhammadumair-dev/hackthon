function AnnouncementList({ announcements = [] }) {
  if (!announcements.length) {
    return <p className="mt-3 text-sm text-slate-600">No announcements are available yet.</p>
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {announcements.map((announcement) => (
        <li key={announcement.id} className="py-3 first:pt-0 last:pb-0">
          <h3 className="font-medium text-slate-900">{announcement.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{announcement.message}</p>
          <time className="mt-2 block text-xs text-slate-400" dateTime={announcement.createdAt}>
            {new Date(announcement.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  )
}

export default AnnouncementList