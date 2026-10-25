import { Navigate, Route, Routes } from 'react-router-dom'
import ConnectionError from '../components/ConnectionError.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import useAuth from '../context/useAuth.js'
import RoleLayout from '../layouts/RoleLayout.jsx'
import SettingsLayout from '../layouts/SettingsLayout.jsx'
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx'
import AnnouncementsPage from '../pages/AnnouncementsPage.jsx'
import AuditLogPage from '../pages/AuditLogPage.jsx'
import AttendanceBoardPage from '../pages/AttendanceBoardPage.jsx'
import AttendanceCorrectionsPage from '../pages/AttendanceCorrectionsPage.jsx'
import CatalogSettingsPage from '../pages/CatalogSettingsPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import CompanySettingsPage from '../pages/CompanySettingsPage.jsx'
import EmployeeDashboardPage from '../pages/EmployeeDashboardPage.jsx'
import EmployeeLeavePage from '../pages/EmployeeLeavePage.jsx'
import EmployeeFormPage from '../pages/EmployeeFormPage.jsx'
import EmployeeImportPage from '../pages/EmployeeImportPage.jsx'
import EmployeeProfilePage from '../pages/EmployeeProfilePage.jsx'
import EmployeesPage from '../pages/EmployeesPage.jsx'
import HRUsersSettingsPage from '../pages/HRUsersSettingsPage.jsx'
import HRDashboardPage from '../pages/HRDashboardPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import LeaveRequestsPage from '../pages/LeaveRequestsPage.jsx'
import PayrollPage from '../pages/PayrollPage.jsx'
import MyPayslipsPage from '../pages/MyPayslipsPage.jsx'
import MyAttendancePage from '../pages/MyAttendancePage.jsx'
import SetupPage from '../pages/SetupPage.jsx'

function HomeRedirect() {
  const { setupComplete, user } = useAuth()

  if (!setupComplete) {
    return <Navigate to="/setup" replace />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={user.mustChangePassword ? '/change-password' : '/dashboard'} replace />
}

function SetupRoute() {
  const { setupComplete } = useAuth()
  return setupComplete
    ? <HomeRedirect />
    : <SetupPage />
}

function LoginRoute() {
  const { setupComplete, user } = useAuth()
  if (!setupComplete) {
    return <Navigate to="/setup" replace />
  }
  return user ? <HomeRedirect /> : <LoginPage />
}

function ChangePasswordRoute() {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <ChangePasswordPage />
}

function DashboardRoute() {
  const { user } = useAuth()
  const dashboards = {
    admin: <AdminDashboardPage />,
    hr: <HRDashboardPage />,
    employee: <EmployeeDashboardPage />,
  }

  return (
    <ProtectedRoute>
      {user && (
        <RoleLayout>
          {dashboards[user.role]}
        </RoleLayout>
      )}
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const { loading, error, retry } = useAuth()
  if (loading) {
    return <LoadingState message="Checking setup and restoring your session..." />
  }
  if (error) {
    return <ConnectionError message={error} onRetry={retry} />
  }

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/setup" element={<SetupRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/change-password"
        element={<ProtectedRoute allowPasswordChange><ChangePasswordRoute /></ProtectedRoute>}
      />
      <Route path="/dashboard" element={<DashboardRoute />} />
      <Route
        path="/announcements"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
            <RoleLayout><AnnouncementsPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/audit-log"
        element={(
          <ProtectedRoute allowedRoles={['admin']}>
            <RoleLayout><AuditLogPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/attendance"
        element={(
          <ProtectedRoute allowedRoles={['employee']}>
            <RoleLayout><MyAttendancePage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/attendance/board"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout><AttendanceBoardPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/attendance/corrections"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr', 'employee']}>
            <RoleLayout><AttendanceCorrectionsPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/leave"
        element={(
          <ProtectedRoute allowedRoles={['employee']}>
            <RoleLayout><EmployeeLeavePage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/leave/requests"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout><LeaveRequestsPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/payroll"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout><PayrollPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/payslips"
        element={(
          <ProtectedRoute allowedRoles={['employee']}>
            <RoleLayout><MyPayslipsPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/employees"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout><EmployeesPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/employees/new"
        element={(
          <ProtectedRoute allowedRoles={['hr']}>
            <RoleLayout><EmployeeFormPage mode="create" /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/employees/import"
        element={(
          <ProtectedRoute allowedRoles={['hr']}>
            <RoleLayout><EmployeeImportPage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/employees/:id/edit"
        element={(
          <ProtectedRoute allowedRoles={['hr']}>
            <RoleLayout><EmployeeFormPage mode="edit" /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/employees/:id"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout><EmployeeProfilePage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/profile"
        element={(
          <ProtectedRoute allowedRoles={['employee']}>
            <RoleLayout><EmployeeProfilePage /></RoleLayout>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute allowedRoles={['admin', 'hr']}>
            <RoleLayout>
              <SettingsLayout />
            </RoleLayout>
          </ProtectedRoute>
        )}
      >
        <Route index element={<Navigate to="company" replace />} />
        <Route path="company" element={<CompanySettingsPage />} />
        <Route path="departments" element={<CatalogSettingsPage resource="departments" />} />
        <Route path="designations" element={<CatalogSettingsPage resource="designations" />} />
        <Route path="leave-types" element={<CatalogSettingsPage resource="leave-types" />} />
        <Route path="holidays" element={<CatalogSettingsPage resource="holidays" />} />
        <Route path="hr-users" element={<HRUsersSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}

export default AppRoutes
