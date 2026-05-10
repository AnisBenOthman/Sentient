CREATE INDEX IF NOT EXISTS "employees_hireDate_idx" ON "hr_core"."employees"("hireDate");
CREATE INDEX IF NOT EXISTS "salary_history_reason_effectiveDate_idx" ON "hr_core"."salary_history"("reason", "effectiveDate");
CREATE INDEX IF NOT EXISTS "leave_requests_startDate_status_idx" ON "hr_core"."leave_requests"("startDate", "status");
CREATE INDEX IF NOT EXISTS "employee_skills_deletedAt_employeeId_idx" ON "hr_core"."employee_skills"("deletedAt", "employeeId");
