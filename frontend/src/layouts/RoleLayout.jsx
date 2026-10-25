import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import api from '../api/axios.js'
import AiChatPanel from '../components/AiChatPanel.jsx'
import useAuth from '../context/useAuth.js'

const roleMenus = {
  admin: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Employees', to: '/employees' },
    { label: 'Attendance Board', to: '/attendance/board' },
    { label: 'Corrections', to: '/attendance/corrections' },
    { label: 'Leave Requests', to: '/leave/requests' },
    { label: 'Payroll', to: '/payroll' },
    { label: 'Announcements', to: '/announcements' },
    { label: 'Audit log', to: '/audit-log' },
    { label: 'Settings', section: true },
    { label: 'Company settings', to: '/settings/company' },
    { label: 'Departments', to: '/settings/departments' },
    { label: 'Designations', to: '/settings/designations' },
    { label: 'Leave types', to: '/settings/leave-types' },
    { label: 'Holidays', to: '/settings/holidays' },
    { label: 'HR users', to: '/settings/hr-users' },
  ],
  hr: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Employees', to: '/employees' },
    { label: 'Attendance Board', to: '/attendance/board' },
    { label: 'Corrections', to: '/attendance/corrections' },
    { label: 'Leave Requests', to: '/leave/requests' },
    { label: 'Payroll', to: '/payroll' },
    { label: 'Announcements', to: '/announcements' },
    { label: 'Settings', section: true },
    { label: 'Company settings', to: '/settings/company' },
    { label: 'Departments', to: '/settings/departments' },
    { label: 'Designations', to: '/settings/designations' },
    { label: 'Leave types', to: '/settings/leave-types' },
    { label: 'Holidays', to: '/settings/holidays' },
    { label: 'HR users', to: '/settings/hr-users' },
  ],
  employee: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'My Profile', to: '/profile' },
    { label: 'My Attendance', to: '/attendance' },
    { label: 'Corrections', to: '/attendance/corrections' },
    { label: 'Leave', to: '/leave' },
    { label: 'My Payslips', to: '/payslips' },
    { label: 'Announcements', to: '/announcements' },
  ],
}

const roleLabels = {
  admin: 'Admin',
  hr: 'HR',
  employee: 'Employee',
}

function RoleLayout({ children }) {
  const { user, logout } = useAuth()
  const menu = roleMenus[user.role]
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationError, setNotificationError] = useState('')

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
      setNotificationError('')
    } catch (error) {
      setNotificationError(error.response?.data?.message || 'Could not load notifications.')
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/api/notifications')
      .then(({ data }) => {
        if (!active) return
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
        setNotificationError('')
      })
      .catch((error) => {
        if (active) setNotificationError(error.response?.data?.message || 'Could not load notifications.')
      })
    return () => { active = false }
  }, [])

  const markNotificationRead = async (notification) => {
    if (!notification.isRead) {
      try {
        await api.post(`/api/notifications/${notification.id}/read`, {})
        await loadNotifications()
      } catch (error) {
        setNotificationError(error.response?.data?.message || 'Could not mark notification as read.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <Link to="/dashboard" className="font-semibold">HCM Lite</Link>
          <p className="text-xs text-slate-500">{roleLabels[user.role]} workspace</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              aria-expanded={notificationOpen}
              onClick={() => {
                const shouldOpen = !notificationOpen
                setNotificationOpen(shouldOpen)
                if (shouldOpen) loadNotifications()
              }}
              className="relative rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Notifications
              {unreadCount > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
            </button>
            {notificationOpen && (
              <div className="absolute right-0 z-20 mt-2 max-h-96 w-[min(90vw,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <h2 className="px-2 py-1 text-sm font-semibold">Notifications</h2>
                {notificationError && <p className="px-2 py-2 text-sm text-red-700" role="alert">{notificationError}</p>}
                {!notificationError && notifications.length === 0 && <p className="px-2 py-3 text-sm text-slate-600">No notifications yet.</p>}
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => markNotificationRead(notification)}
                      className={`block w-full rounded-lg px-2 py-3 text-left hover:bg-slate-50 ${notification.isRead ? 'opacity-70' : ''}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{notification.title}</span>
                        {!notification.isRead && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">{notification.message}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="max-w-40 truncate text-sm text-slate-600">{user.name}</span>
          <Link to="/change-password" className="text-sm font-medium underline">Change password</Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)] flex-col sm:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white p-3 sm:w-56 sm:border-b-0 sm:border-r sm:p-4">
          <nav aria-label={`${roleLabels[user.role]} menu`} className="flex flex-wrap gap-2 sm:flex-col">
            {menu.map((item) => (
              item.section
                ? <span key={item.label} className="basis-full px-3 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</span>
                : <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-8">
          {children || <Outlet />}
        </main>
      </div>
      <AiChatPanel />
    </div>
  )
}

export default RoleLayout
