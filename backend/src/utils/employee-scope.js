const AppError = require('./app-error')

const resolveEmployeeScope = (user, requestedEmployeeId) => {
  if (user.role !== 'employee') {
    return requestedEmployeeId
  }

  if (!user.employeeId) {
    throw new AppError(403, 'This employee account is not linked to an employee record.')
  }

  if (requestedEmployeeId && requestedEmployeeId !== user.employeeId) {
    throw new AppError(403, 'You are not allowed to access another employee record.')
  }

  return user.employeeId
}

module.exports = resolveEmployeeScope
