import { NavLink, Outlet } from 'react-router-dom'

const sections = [
  { label: 'Company settings', path: 'company' },
  { label: 'Departments', path: 'departments' },
  { label: 'Designations', path: 'designations' },
  { label: 'Leave types', path: 'leave-types' },
  { label: 'Holidays', path: 'holidays' },
  { label: 'HR users', path: 'hr-users' },
]

function SettingsLayout() {
  return (
    <section className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-semibold">Organization settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage company rules and organization lists. Changes apply to new records.
      </p>
      <nav aria-label="Organization settings" className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {sections.map((section) => (
          <NavLink
            key={section.path}
            to={`/settings/${section.path}`}
            className={({ isActive }) =>
              `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`
            }
          >
            {section.label}
          </NavLink>
        ))}
      </nav>
      <div className="pt-5">
        <Outlet />
      </div>
    </section>
  )
}

export default SettingsLayout
