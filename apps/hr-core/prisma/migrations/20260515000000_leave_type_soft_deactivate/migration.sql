-- AlterTable: add isActive to leave_types (default true — all existing rows stay active)
ALTER TABLE hr_core.leave_types ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
