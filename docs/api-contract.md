# API Contract
Har naya ya badla hua endpoint yahan likho. Frontend isi file se banega.

Format:
## METHOD /path
Role: admin | hr | employee
Body: { ... }
Response 2xx: { ... }
Errors: 4xx (reason)

---
## GET /api/health
Role: public
Body: none
Response 2xx: { "status": "ok" }
Errors: none

## GET /api/setup/status
Role: public
Body: none
Response 2xx: { "setupComplete": boolean }
Errors: 500 (database error)

## POST /api/setup
Role: public (only when no user exists)
Body: { "companyName": string, "adminName": string, "email": string, "password": string }
Response 201: { "company": { "id": string, "name": string }, "user": { "id": string, "name": string, "email": string, "role": "admin", "employeeId": null, "isActive": true, "mustChangePassword": false } }
Errors: 400 (invalid input), 403 (setup already completed), 409 (email already exists), 500 (database error)

## POST /api/auth/login
Role: public
Body: { "email": string, "password": string }
Response 200: { "token": string, "user": { "id": string, "name": string, "email": string, "role": "admin" | "hr" | "employee", "employeeId": string | null, "isActive": true, "mustChangePassword": boolean } }
Errors: 400 (invalid input), 401 (invalid credentials or inactive account), 500 (server configuration error)

## POST /api/auth/change-password
Role: admin | hr | employee (authenticated)
Body: { "currentPassword": string, "newPassword": string }
Response 200: { "user": { "id": string, "name": string, "email": string, "role": "admin" | "hr" | "employee", "employeeId": string | null, "isActive": true, "mustChangePassword": false } }
Errors: 400 (invalid input or same password), 401 (missing/invalid token, inactive account, or incorrect current password), 500 (server/database error)

## GET /api/auth/me
Role: admin | hr | employee (authenticated)
Body: none
Response 200: { "user": { "id": string, "name": string, "email": string, "role": "admin" | "hr" | "employee", "employeeId": string | null, "isActive": true, "mustChangePassword": boolean } }
Errors: 401 (missing/invalid token or inactive account), 500 (database error)

## GET /api/settings/company
Role: admin | hr
Body: none
Response 200: { "company": { "id": "primary", "name": string, "officeStart": "HH:MM", "graceMinutes": number, "halfDayHours": number, "weekend": ["Sat" | "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri"], "officeLatitude": number | null, "officeLongitude": number | null, "radiusMeters": number, "timezone": string } }
Errors: 401 (missing/invalid token), 403 (employee or forced password change), 404 (company not found), 500 (database error)

## PATCH /api/settings/company
Role: admin
Body: partial { "name": string, "officeStart": "HH:MM", "graceMinutes": number, "halfDayHours": number, "weekend": string[], "officeLatitude": number | null, "officeLongitude": number | null, "radiusMeters": number, "timezone": string }
Response 200: { "company": { "id": "primary", "name": string, "officeStart": "HH:MM", "graceMinutes": number, "halfDayHours": number, "weekend": string[], "officeLatitude": number | null, "officeLongitude": number | null, "radiusMeters": number, "timezone": string } }
Errors: 400 (invalid input, invalid timezone, or only one office coordinate supplied), 401 (missing/invalid token), 403 (HR, employee or forced password change), 404 (company not found), 500 (database error)

## GET /api/settings/departments
Role: admin | hr
Body: none
Response 200: { "departments": [{ "id": string, "name": string }] }
Errors: 401, 403 (employee or forced password change), 500 (database error)

## POST /api/settings/departments
Role: admin
Body: { "name": string }
Response 201: { "department": { "id": string, "name": string } }
Errors: 400 (invalid input), 401, 403 (HR, employee or forced password change), 409 (duplicate name), 500

## PATCH /api/settings/departments/:id
Role: admin
Body: { "name": string }
Response 200: { "department": { "id": string, "name": string } }
Errors: 400 (invalid input/id), 401, 403 (HR, employee or forced password change), 404 (not found), 409 (duplicate name), 500

## DELETE /api/settings/departments/:id
Role: admin
Body: none
Response 200: { "message": "Department deleted." }
Errors: 401, 403 (HR, employee or forced password change), 404 (not found), 409 (referenced by another record), 500

## GET /api/settings/designations
Role: admin | hr
Body: none
Response 200: { "designations": [{ "id": string, "name": string }] }
Errors: 401, 403 (employee or forced password change), 500

## POST /api/settings/designations
Role: admin
Body: { "name": string }
Response 201: { "designation": { "id": string, "name": string } }
Errors: 400 (invalid input), 401, 403 (HR, employee or forced password change), 409 (duplicate name), 500

## PATCH /api/settings/designations/:id
Role: admin
Body: { "name": string }
Response 200: { "designation": { "id": string, "name": string } }
Errors: 400 (invalid input/id), 401, 403 (HR, employee or forced password change), 404, 409 (duplicate name), 500

## DELETE /api/settings/designations/:id
Role: admin
Body: none
Response 200: { "message": "Designation deleted." }
Errors: 401, 403 (HR, employee or forced password change), 404, 409 (referenced by another record), 500

## GET /api/settings/leave-types
Role: admin | hr
Body: none
Response 200: { "leaveTypes": [{ "id": string, "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean }] }
Errors: 401, 403 (employee or forced password change), 500

## POST /api/settings/leave-types
Role: admin
Body: { "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean }
Response 201: { "leaveType": { "id": string, "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean } }
Errors: 400 (invalid input), 401, 403 (HR, employee or forced password change), 409 (duplicate name), 500

## PATCH /api/settings/leave-types/:id
Role: admin
Body: { "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean }
Response 200: { "leaveType": { "id": string, "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean } }
Errors: 400 (invalid input/id), 401, 403 (HR, employee or forced password change), 404, 409 (duplicate name), 500

## DELETE /api/settings/leave-types/:id
Role: admin
Body: none
Response 200: { "message": "Leave type deleted." }
Errors: 401, 403 (HR, employee or forced password change), 404, 409 (referenced by another record), 500

## GET /api/settings/holidays
Role: admin | hr
Body: none
Response 200: { "holidays": [{ "id": string, "date": "YYYY-MM-DD", "name": string }] }
Errors: 401, 403 (employee or forced password change), 500

## POST /api/settings/holidays
Role: admin
Body: { "date": "YYYY-MM-DD", "name": string }
Response 201: { "holiday": { "id": string, "date": "YYYY-MM-DD", "name": string } }
Errors: 400 (invalid input), 401, 403 (HR, employee or forced password change), 409 (duplicate date), 500

## PATCH /api/settings/holidays/:id
Role: admin
Body: { "date": "YYYY-MM-DD", "name": string }
Response 200: { "holiday": { "id": string, "date": "YYYY-MM-DD", "name": string } }
Errors: 400 (invalid input/id), 401, 403 (HR, employee or forced password change), 404, 409 (duplicate date), 500

## DELETE /api/settings/holidays/:id
Role: admin
Body: none
Response 200: { "message": "Holiday deleted." }
Errors: 401, 403 (HR, employee or forced password change), 404, 500

## GET /api/settings/hr-users
Role: admin | hr
Body: none
Response 200: { "hrUsers": [{ "id": string, "name": string, "email": string, "role": "hr", "isActive": boolean, "mustChangePassword": boolean }] }
Errors: 401, 403 (employee or forced password change), 500

## POST /api/settings/hr-users
Role: admin
Body: { "name": string, "email": string }
Response 201: { "hrUser": { "id": string, "name": string, "email": string, "role": "hr", "isActive": true, "mustChangePassword": true }, "temporaryPassword": string }
Errors: 400 (invalid input), 401, 403 (HR, employee or forced password change), 409 (duplicate email), 500

## PATCH /api/settings/hr-users/:id
Role: admin
Body: { "isActive": boolean }
Response 200: { "hrUser": { "id": string, "name": string, "email": string, "role": "hr", "isActive": boolean, "mustChangePassword": boolean } }
Errors: 400 (invalid input/id), 401, 403 (HR, employee or forced password change), 404 (HR user not found), 500

## POST /api/settings/hr-users/:id/reset-password
Role: admin
Body: none
Response 200: { "hrUser": { "id": string, "name": string, "email": string, "role": "hr", "isActive": boolean, "mustChangePassword": true }, "temporaryPassword": string }
Errors: 400 (invalid id), 401, 403 (HR, employee or forced password change), 404 (HR user not found), 500

## GET /api/employees
Role: admin | hr
Query: { "search"?: string, "department"?: string, "status"?: "active" | "probation" | "exited", "page"?: integer, "pageSize"?: integer }
Body: none
Response 200: { "employees": [{ "id": string, "code": string, "name": string, "email": string, "phone": string, "address": string, "gender": string, "department": { "id": string, "name": string }, "designation": { "id": string, "name": string }, "joinDate": "YYYY-MM-DD", "status": "active" | "probation" | "exited", "exitDate": "YYYY-MM-DD" | null, "basicSalary": number }], "pagination": { "page": integer, "pageSize": integer, "total": integer, "totalPages": integer } }
Errors: 400 (invalid filters/page), 401 (missing/invalid token), 403 (employee or forced password change), 500

## POST /api/employees
Role: hr
Body: { "code": string, "name": string, "email": string, "phone": string, "address": string, "gender": string, "department": string, "designation": string, "joinDate": "YYYY-MM-DD", "status": "active" | "probation" | "exited", "exitDate"?: "YYYY-MM-DD" | null, "basicSalary": number }
Response 201: { "employee": employee object (same fields as GET /api/employees), "temporaryPassword": string }
Errors: 400 (invalid fields or unknown department/designation), 401, 403 (Admin/Employee or forced password change), 409 (duplicate code/email), 500

## GET /api/employees/export
Role: hr
Query: same filters as GET /api/employees except page/pageSize
Body: none
Response 200: CSV file with employee directory columns; no passwords
Errors: 400 (invalid filters), 401, 403 (Admin/Employee or forced password change), 500

## POST /api/employees/import?dryRun=true
Role: hr
Body: { "csv": string } (CSV headers: code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary; department/designation values are existing names)
Response 200: { "dryRun": true, "totalRows": integer, "validRows": integer, "errors": [{ "row": integer, "field": string, "reason": string }] }
Errors: 400 (invalid CSV/query), 401, 403 (Admin/Employee or forced password change), 413 (CSV exceeds limit), 500

## POST /api/employees/import?dryRun=false
Role: hr
Body: { "csv": string } (same format as dry-run)
Response 201: { "dryRun": false, "created": integer, "employees": [employee object], "credentials": [{ "employeeId": string, "email": string, "temporaryPassword": string }] }; each temporary password is returned only in this creation response
Errors: 400 (invalid CSV/query), 401, 403 (Admin/Employee or forced password change), 409 (code/email conflict), 422 (one or more invalid rows; nothing created), 413, 500

## GET /api/employees/me
Role: employee
Body: none
Response 200: { "employee": employee object without basicSalary }
Errors: 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee not found), 500

## GET /api/employees/:id
Role: admin | hr | employee (employee can access only their linked id)
Body: none
Response 200: { "employee": employee object; Employee role never receives basicSalary }. HR may change basicSalary as part of the employee update.
Errors: 400 (invalid id), 401, 403 (Employee requests another record or forced password change), 404, 500

## PUT /api/employees/me
Role: employee
Body: { "phone": string, "address": string }
Response 200: { "employee": employee object without basicSalary }
Errors: 400, 401, 403 (non-employee, forced password change, or no linked employee), 404, 500

## PUT /api/employees/:id
Role: hr | employee (Employee can edit only own phone and address)
Body: HR sends employee fields from POST /api/employees; Employee sends exactly { "phone": string, "address": string }
Response 200: { "employee": employee object; Employee role never receives basicSalary }
Errors: 400, 401, 403 (Admin or Employee requests another record/edits any other field), 404, 409 (duplicate code/email), 500

## PATCH /api/employees/:id/login
Role: hr
Body: { "isActive": boolean }
Response 200: { "user": { "id": string, "email": string, "role": "employee", "isActive": boolean, "mustChangePassword": boolean } }
Errors: 400, 401, 403 (Admin/Employee), 404, 500

## POST /api/employees/:id/reset-password
Role: hr
Body: none
Response 200: { "user": { "id": string, "email": string, "role": "employee", "isActive": boolean, "mustChangePassword": true }, "temporaryPassword": string }
Errors: 400, 401, 403 (Admin/Employee), 404, 500

## POST /api/attendance/check-in
Role: employee
Body: none
Response 201: { "timezone": string, "attendance": { "id": string, "date": "YYYY-MM-DD", "checkIn": ISO datetime, "checkInTime": "HH:MM", "checkOut": null, "status": "present" | "late", "workedHours": 0, "note": string | null } }
Errors: 400 (unexpected request fields), 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 409 (attendance record already exists for the day), 500

## POST /api/attendance/check-out
Role: employee
Body: none
Response 200: { "timezone": string, "attendance": { "id": string, "date": "YYYY-MM-DD", "checkIn": ISO datetime, "checkInTime": "HH:MM", "checkOut": ISO datetime, "checkOutTime": "HH:MM", "status": "present" | "late" | "half_day", "workedHours": number, "note": string | null } }
Errors: 400 (unexpected request fields), 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 409 (no check-in or already checked out), 500

## GET /api/attendance/my?month=YYYY-MM
Role: employee
Body: none
Response 200: { "month": "YYYY-MM", "timezone": string, "today": { "date": "YYYY-MM-DD", "status": "present" | "late" | "half_day" | "absent" | "missing_checkout" | "on_leave" | null, "checkIn": ISO datetime | null, "checkInTime": "HH:MM" | null, "checkOut": ISO datetime | null, "checkOutTime": "HH:MM" | null, "workedHours": number, "note": string | null }, "days": [{ "date": "YYYY-MM-DD", "status": "present" | "late" | "half_day" | "absent" | "missing_checkout" | "on_leave" | null, "checkIn": ISO datetime | null, "checkInTime": "HH:MM" | null, "checkOut": ISO datetime | null, "checkOutTime": "HH:MM" | null, "workedHours": number, "note": string | null }] }
Errors: 400 (invalid month), 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 500

## GET /api/attendance/board?date=YYYY-MM-DD&department=:id
Role: admin | hr
Body: none
Response 200: { "date": "YYYY-MM-DD", "timezone": string, "employees": [{ "employeeId": string, "code": string, "name": string, "department": { "id": string, "name": string }, "status": "present" | "late" | "half_day" | "absent" | "missing_checkout" | "on_leave" | null, "checkInTime": "HH:MM" | null, "checkOutTime": "HH:MM" | null, "workedHours": number, "note": string | null }] }
Errors: 400 (invalid date/department), 401, 403 (employee or forced password change), 500

## POST /api/attendance/corrections
Role: employee
Body: { "date": "YYYY-MM-DD", "requestedCheckIn": "HH:MM", "requestedCheckOut": "HH:MM", "reason": string }
Response 201: { "correction": { "id": string, "employeeId": string, "date": "YYYY-MM-DD", "requestedCheckIn": "HH:MM", "requestedCheckOut": "HH:MM", "reason": string, "status": "pending", "comment": null, "createdAt": ISO datetime } }
Errors: 400 (invalid input/future date), 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 409 (pending correction already exists for this date), 500

## GET /api/attendance/corrections
Role: admin | hr | employee
Query: none
Body: none
Response 200: { "corrections": [{ "id": string, "employeeId": string, "employee": { "name": string, "code": string }, "date": "YYYY-MM-DD", "requestedCheckIn": "HH:MM", "requestedCheckOut": "HH:MM", "reason": string, "status": "pending" | "approved" | "rejected", "comment": string | null, "createdAt": ISO datetime }] }
Scope: HR receives pending requests, Admin can view all requests, and Employees receive only their own requests.
Errors: 401, 403 (forced password change; employee sees own requests only), 500

## POST /api/attendance/corrections/:id/approve
Role: hr
Body: { "comment": string }
Response 200: { "correction": { "id": string, "employeeId": string, "employee": { "name": string, "code": string }, "date": "YYYY-MM-DD", "requestedCheckIn": "HH:MM", "requestedCheckOut": "HH:MM", "reason": string, "status": "approved", "comment": string, "createdAt": ISO datetime } }
Errors: 400 (invalid id/comment), 401, 403 (admin, employee, or forced password change), 404 (correction not found), 409 (correction is not pending or requested checkout is not after check-in), 500

## POST /api/attendance/corrections/:id/reject
Role: hr
Body: { "comment": string }
Response 200: { "correction": { "id": string, "employeeId": string, "employee": { "name": string, "code": string }, "date": "YYYY-MM-DD", "requestedCheckIn": "HH:MM", "requestedCheckOut": "HH:MM", "reason": string, "status": "rejected", "comment": string, "createdAt": ISO datetime } }
Errors: 400 (invalid id/comment), 401, 403 (admin, employee, or forced password change), 404 (correction not found), 409 (correction is not pending), 500

## GET /api/leave/balance
Role: employee
Query: none
Body: none
Response 200: { "year": integer, "leaveTypes": [{ "id": string, "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "isPaid": boolean, "used": number, "remaining": number | null }] }
Errors: 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 500

## GET /api/leave/workdays?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Role: employee
Query: { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
Body: none
Response 200: { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": integer, "workingDates": ["YYYY-MM-DD"] }. A valid range with no working dates returns days: 0.
Errors: 400 (invalid dates or range), 401, 403 (non-employee or forced password change), 404 (company not found), 500

## POST /api/leave
Role: employee
Body: { "leaveType": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": string }
Response 201: { "leave": { "id": string, "employeeId": string, "leaveType": { "id": string, "name": string, "isUnlimited": boolean, "isPaid": boolean }, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": number, "reason": string, "status": "pending", "reviewedBy": null, "reviewedAt": null, "reviewComment": null, "createdAt": ISO datetime } }
Errors: 400 (invalid input/date), 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee, company, or leave type not found), 409 (concurrent duplicate), 422 (end before start, no working days, overlap, or quota exceeded), 500

## GET /api/leave/my
Role: employee
Query: none
Body: none
Response 200: { "leaves": [leave object; includes pending, approved, rejected, and cancelled requests] }
Errors: 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee not found), 500

## POST /api/leave/:id/cancel
Role: employee
Body: none
Response 200: { "leave": leave object with status "cancelled" }
Errors: 400 (invalid id or unexpected body), 401, 403 (non-employee or not own request), 404 (request not found), 409 (request is no longer pending), 500

## GET /api/leave/requests?status=pending&department=:id&page=1&pageSize=10
Role: admin | hr
Query: { "status"?: "pending" | "approved" | "rejected" | "cancelled" | "all", "department"?: string, "page"?: integer, "pageSize"?: integer }
Body: none
Response 200: { "leaves": [leave object with employee { "id": string, "name": string, "code": string, "department": { "id": string, "name": string } }], "pagination": { "page": integer, "pageSize": integer, "total": integer, "totalPages": integer } }
Scope: HR can review pending requests; Admin is read-only. Omitting status defaults to pending; all returns every status.
Errors: 400 (invalid filters/page), 401, 403 (forced password change), 500

## POST /api/leave/:id/approve
Role: hr
Body: { "comment": string }
Response 200: { "leave": leave object with status "approved" }
Errors: 400 (invalid id/comment), 401, 403 (admin, employee, or forced password change), 404 (request not found), 409 (already reviewed or concurrent conflict), 422 (overlap or current balance exceeded), 500

## POST /api/leave/:id/reject
Role: hr
Body: { "comment": string }
Response 200: { "leave": leave object with status "rejected" }
Errors: 400 (invalid id/comment), 401, 403 (admin, employee, or forced password change), 404 (request not found), 409 (already reviewed), 500

## GET /api/notifications
Role: admin | hr | employee
Query: none
Body: none
Response 200: { "unreadCount": integer, "notifications": [{ "id": string, "title": string, "message": string, "isRead": boolean, "createdAt": ISO datetime }] }
Scope: only notifications belonging to the authenticated user.
Errors: 401, 403 (forced password change), 500

## POST /api/notifications/:id/read
Role: admin | hr | employee
Body: none
Response 200: { "notification": { "id": string, "title": string, "message": string, "isRead": true, "createdAt": ISO datetime } }
Scope: only the authenticated user's notification can be marked read.
Errors: 400 (invalid id or unexpected body), 401, 403 (forced password change), 404 (notification not found in own scope), 500

## POST /api/payroll/runs
Role: hr
Body: { "month": "YYYY-MM", "regenerate"?: boolean }
Response 201 (new run) or 200 (regenerated draft): { "run": { "id": string, "month": "YYYY-MM", "status": "draft", "createdBy": string, "finalizedBy": null, "finalizedAt": null, "createdAt": ISO datetime }, "items": [{ "id": string, "runId": string, "month": "YYYY-MM", "employee": { "id": string, "code": string, "name": string, "department": string | null }, "basic": number, "hra": number, "medical": number, "gross": number, "workingDays": integer, "absentDays": number, "unpaidLeaveDays": number, "halfDays": number, "deduction": number, "annualTax": number, "monthlyTax": number, "netPay": number, "daysPayable": number }] }
Behavior: creates one monthly draft for employees employed during the month. If a draft already exists, regenerate=true replaces its items; finalized runs cannot be regenerated. Salary components and gross are prorated by employee-payable working days for joiners/leavers; deductions use full monthly gross divided by the company's total working days in that month, and tax is prorated by payable days.
Errors: 400 (invalid month/body), 401, 403 (Admin/Employee or forced password change), 404 (company not found), 409 (month already has a run and regenerate was not requested, or run finalized), 500

## GET /api/payroll/runs
Role: admin | hr
Query: none
Body: none
Response 200: { "runs": [{ "id": string, "month": "YYYY-MM", "status": "draft" | "finalized", "createdBy": string, "finalizedBy": string | null, "finalizedAt": ISO datetime | null, "createdAt": ISO datetime, "itemCount": integer }] }
Errors: 401, 403 (Employee or forced password change), 500

## GET /api/payroll/runs/:id
Role: admin | hr
Body: none
Response 200: { "run": payroll run object, "items": [{ "id": string, "runId": string, "month": "YYYY-MM", "employee": { "id": string, "code": string, "name": string, "department": string | null }, "basic": number, "hra": number, "medical": number, "gross": number, "workingDays": integer, "absentDays": number, "unpaidLeaveDays": number, "halfDays": number, "deduction": number, "annualTax": number, "monthlyTax": number, "netPay": number, "daysPayable": number }] }
Errors: 400 (invalid id), 401, 403 (Employee or forced password change), 404 (run not found), 500

## POST /api/payroll/runs/:id/finalize
Role: admin
Body: none
Response 200: { "run": payroll run object with status "finalized", finalizedBy: string, finalizedAt: ISO datetime }. Employees with payslips in the run receive an in-app notification.
Errors: 400 (invalid id or unexpected body), 401, 403 (HR/Employee or forced password change), 404 (run not found), 409 (already finalized), 500

## GET /api/payroll/payslips/my
Role: employee
Body: none
Response 200: { "payslips": [{ "id": string, "runId": string, "month": "YYYY-MM", "status": "finalized", "basic": number, "hra": number, "medical": number, "gross": number, "workingDays": integer, "absentDays": number, "unpaidLeaveDays": number, "halfDays": number, "deduction": number, "annualTax": number, "monthlyTax": number, "netPay": number, "daysPayable": number }] }
Scope: only the authenticated employee's payslips from finalized runs.
Errors: 401, 403 (non-employee, forced password change, or no linked employee), 500

## GET /api/payroll/payslips/:id/pdf
Role: admin | hr | employee
Body: none
Response 200: application/pdf download. HR/Admin may download any payslip; Employee may download only their own payslip and only after its run is finalized.
Errors: 400 (invalid id), 401, 403 (Employee requests another employee's or a draft payslip, or forced password change), 404 (payslip not found), 500 (PDF generation failure)

## GET /api/dashboard/hr?from=YYYY-MM-DD&to=YYYY-MM-DD&department=:id
Role: admin | hr
Query: { "from"?: "YYYY-MM-DD", "to"?: "YYYY-MM-DD", "department"?: string }. Defaults to the current month through today in the company timezone. Date range maximum is 366 days.
Body: none
Response 200: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "headcount": integer, "presentToday": integer, "onLeaveToday": integer, "lateToday": integer, "pendingApprovals": { "leave": integer, "attendanceCorrections": integer, "total": integer }, "attendanceTrend": [{ "date": "YYYY-MM-DD", "attendanceRate": number, "latePercent": number, "present": integer, "late": integer, "missingCheckout": integer, "halfDay": integer, "absent": integer, "onLeave": integer, "expectedDays": integer }], "absenteeismByDepartment": [{ "departmentId": string | null, "department": string, "absentDays": number, "expectedDays": number, "absenteeismRate": number }], "leaveByType": [{ "leaveTypeId": string, "name": string, "approvedDays": number, "yearlyQuota": number | null, "isUnlimited": boolean, "utilizationPercent": number | null }], "topLateComers": [{ "employeeId": string, "name": string, "code": string, "department": string | null, "lateCount": integer }], "announcements": [{ "id": string, "title": string, "message": string, "createdAt": ISO datetime }] }
Scope: HR and Admin see company-wide metrics, optionally filtered by department. Present/on-leave/late KPIs are for today; trend and period metrics use from/to.
Errors: 400 (invalid dates, range, or department), 401, 403 (Employee or forced password change), 404 (company not found), 500

## GET /api/dashboard/admin?from=YYYY-MM-DD&to=YYYY-MM-DD&department=:id
Role: admin
Query: { "from"?: "YYYY-MM-DD", "to"?: "YYYY-MM-DD", "department"?: string }. Defaults to January 1 of the current year through today in the company timezone. Date range maximum is 366 days.
Body: none
Response 200: { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "headcount": integer, "attrition": { "exits": integer, "averageHeadcount": number, "rate": number }, "payrollCost": { "gross": number, "net": number, "byMonth": [{ "month": "YYYY-MM", "gross": number, "net": number }], "byDepartment": [{ "departmentId": string | null, "department": string, "gross": number, "net": number }] }, "averageSalary": number, "averageSalaryByDepartmentDesignation": [{ "departmentId": string | null, "department": string, "designationId": string | null, "designation": string, "averageGrossSalary": number, "headcount": integer }], "headcountByDepartment": [{ "departmentId": string | null, "department": string, "headcount": integer }], "genderBreakdown": [{ "gender": string, "headcount": integer }], "tenureBreakdown": [{ "range": "Under 1 year" | "1-3 years" | "3-5 years" | "5+ years", "headcount": integer }], "auditFeed": [{ "id": string, "actor": string, "action": string, "entityType": string, "entityId": string | null, "createdAt": ISO datetime }], "announcements": [{ "id": string, "title": string, "message": string, "createdAt": ISO datetime }] }
Scope: company-wide metrics optionally filtered by department. Headcount and average salary are as of to; attrition uses exits during from-to divided by average headcount at range start/end; payroll includes finalized runs for months intersecting from-to.
Errors: 400 (invalid dates, range, or department), 401, 403 (HR, Employee, or forced password change), 404 (company not found), 500

## GET /api/dashboard/employee
Role: employee
Query: none
Body: none
Response 200: { "today": { "date": "YYYY-MM-DD", "status": "present" | "late" | "half_day" | "missing_checkout" | "on_leave" | "absent" | null, "checkInTime": "HH:MM" | null, "workedHours": number }, "week": { "workedHours": number, "targetHours": 40 }, "lateCountThisMonth": integer, "leaveBalance": { "year": integer, "leaveTypes": [{ "id": string, "name": string, "yearlyQuota": number | null, "isUnlimited": boolean, "used": number, "remaining": number | null }] }, "lastPayslip": { "id": string, "month": "YYYY-MM", "gross": number, "netPay": number } | null, "announcements": [{ "id": string, "title": string, "message": string, "createdAt": ISO datetime }] }
Scope: only the authenticated Employee's own record, attendance, leave balance, and finalized payslips; no company or colleague data.
Errors: 401, 403 (non-employee, forced password change, or no linked employee), 404 (employee/company not found), 500

## POST /api/ai/chat
Role: admin | hr | employee
Body: { "message": string (1-2000 characters), "history"?: [{ "role": "user" | "assistant", "content": string (1-2000 characters) }] } (maximum 20 history entries; only the latest 10 are sent to Gemini)
Response 200: { "reply": string, "aiGenerated": true }
Behavior: Gemini function calling uses read-only existing analytics, attendance, leave, payroll and employee services. Employee tools are restricted to the signed-in employee's own data; company-wide analytics and employee search are Admin/HR only. Employee colleague salary/private-data requests are refused. Every request is recorded in the `ai_logs` MongoDB collection with user, role, message, tool names, status and duration. Provider, validation, and timeout failures return a friendly fallback in the 200 response. AI calls time out after 15 seconds.
Errors: 400 (invalid request), 401, 403 (forced password change), 429 (more than 20 AI requests in a rolling hour), 503 (AI request logging or rate-limit storage unavailable)

## POST /api/ai/dashboard-summary
Role: admin | hr
Body: { "kpis": object, "filters": { "from"?: "YYYY-MM-DD", "to"?: "YYYY-MM-DD", "department"?: string } } (`kpis` must be valid JSON under 20 KB; filters follow the dashboard date range rules)
Response 200: { "summary": { "bullets": [string, string, string, ...] } | null, "message": string | null, "aiGenerated": true }
Behavior: server recomputes KPIs through the same analytics dashboard service for the supplied filters rather than trusting client-provided numbers. Successful summaries contain 3-5 bullets and are checked to ensure every numeric value came from those KPI results. Provider, timeout, or output-validation failures return a friendly message with `summary: null`.
Errors: 400 (invalid body/filters), 401, 403 (Employee or forced password change), 429 (more than 20 AI requests in a rolling hour), 503 (AI request logging or rate-limit storage unavailable)

## POST /api/ai/smart-leave
Role: employee
Body: { "text": string (1-1000 characters) }
Response 200: { "suggestion": { "type": string (configured leave type id), "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "reason": string } | null, "message": string | null, "aiGenerated": true }
Behavior: company-local today, timezone and configured leave types are provided to Gemini. Response is zod-validated; invalid output is retried once. This endpoint only suggests form values and never creates a leave request. Provider, timeout, or output-validation failures return a friendly message with `suggestion: null`.
Errors: 400 (invalid body), 401, 403 (non-Employee, forced password change, or no linked employee), 429 (more than 20 AI requests in a rolling hour), 503 (AI request logging or rate-limit storage unavailable)

## GET /api/audit-logs?action=&entityType=&actor=&from=&to=&page=1&pageSize=20
Role: admin
Query: optional action/entityType strings, actor ObjectId, ISO datetime from/to, page (>=1), pageSize (1-100)
Body: none
Response 200: { "entries": [{ "id": string, "actor": { "id": string, "name": string, "email": string, "role": string } | null, "actorRole": string, "action": string, "entityType": string, "entityId": string | null, "before": object | null, "after": object | null, "createdAt": ISO datetime }], "pagination": { "page": integer, "pageSize": integer, "total": integer, "totalPages": integer } }
Behavior: append-only records; there are no API routes to update or delete them. Passwords, hashes, tokens and secrets are redacted before storage.
Errors: 400 (invalid filters/page), 401, 403 (HR/Employee or forced password change), 500

## GET /api/announcements
Role: admin | hr | employee
Body: none
Response 200: { "announcements": [{ "id": string, "title": string, "message": string, "postedBy": { "id": string, "name": string, "role": "admin" | "hr" }, "createdAt": ISO datetime }] } (latest 5)
Errors: 401, 403 (forced password change), 500

## POST /api/announcements
Role: admin | hr
Body: { "title": string, "message": string }
Response 201: { "announcement": { "id": string, "title": string, "message": string, "postedBy": { "id": string, "name": string, "role": "admin" | "hr" }, "createdAt": ISO datetime } }
Errors: 400 (invalid input), 401, 403 (Employee or forced password change), 500
