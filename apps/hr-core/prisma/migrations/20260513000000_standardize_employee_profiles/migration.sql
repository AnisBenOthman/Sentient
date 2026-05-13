CREATE UNIQUE INDEX IF NOT EXISTS "employees_active_full_name_unique_idx"
  ON hr_core.employees (lower(btrim("firstName")), lower(btrim("lastName")))
  WHERE "deletedAt" IS NULL;
