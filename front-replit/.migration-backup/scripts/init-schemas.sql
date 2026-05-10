-- ============================================================
-- Sentient HRIS — Database Initialization Script
-- ============================================================
-- Idempotent: safe to run multiple times (CREATE IF NOT EXISTS).
-- Run once after `docker compose up -d` before any Prisma migrations.
--
-- Usage:
--   psql -U postgres -d sentient -f scripts/init-schemas.sql
-- ============================================================

-- ── 1. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Schemas ───────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS hr_core;
CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS ai_agent;

-- ── 3. Roles (idempotent via exception handling) ─────────────────────────────

-- HR Core service role — full access to hr_core schema
DO $$
BEGIN
  CREATE ROLE hr_core_svc WITH LOGIN PASSWORD 'hr_core_pass';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Social service role — full access to social schema
DO $$
BEGIN
  CREATE ROLE social_svc WITH LOGIN PASSWORD 'social_pass';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AI Agentic service role — full access to ai_agent schema
DO $$
BEGIN
  CREATE ROLE ai_agent_svc WITH LOGIN PASSWORD 'ai_pass';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Analytics read-only role — SELECT only on hr_core schema
-- WHY: The Analytics Agent uses Text-to-SQL with this role to prevent
-- any accidental mutations. It cannot INSERT, UPDATE, DELETE, or DDL.
DO $$
BEGIN
  CREATE ROLE ai_analytics_readonly WITH LOGIN PASSWORD 'readonly_pass';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ── 4. Schema USAGE grants ───────────────────────────────────────────────────
GRANT USAGE ON SCHEMA hr_core TO hr_core_svc;
GRANT USAGE ON SCHEMA social TO social_svc;
GRANT USAGE ON SCHEMA ai_agent TO ai_agent_svc;
GRANT USAGE ON SCHEMA hr_core TO ai_analytics_readonly;

-- ── 5. Table privileges on existing tables ───────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr_core TO hr_core_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr_core TO hr_core_svc;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA social TO social_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA social TO social_svc;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai_agent TO ai_agent_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ai_agent TO ai_agent_svc;

-- Analytics role: SELECT only (no sequences needed — read-only)
GRANT SELECT ON ALL TABLES IN SCHEMA hr_core TO ai_analytics_readonly;

-- ── 6. Default privileges for future tables ──────────────────────────────────
-- WHY: ALTER DEFAULT PRIVILEGES ensures that tables created by Prisma migrations
-- automatically inherit the correct grants without needing to re-run this script.

ALTER DEFAULT PRIVILEGES IN SCHEMA hr_core
  GRANT ALL PRIVILEGES ON TABLES TO hr_core_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA hr_core
  GRANT ALL PRIVILEGES ON SEQUENCES TO hr_core_svc;

ALTER DEFAULT PRIVILEGES IN SCHEMA social
  GRANT ALL PRIVILEGES ON TABLES TO social_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA social
  GRANT ALL PRIVILEGES ON SEQUENCES TO social_svc;

ALTER DEFAULT PRIVILEGES IN SCHEMA ai_agent
  GRANT ALL PRIVILEGES ON TABLES TO ai_agent_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai_agent
  GRANT ALL PRIVILEGES ON SEQUENCES TO ai_agent_svc;

-- Analytics readonly: SELECT on all future hr_core tables
ALTER DEFAULT PRIVILEGES IN SCHEMA hr_core
  GRANT SELECT ON TABLES TO ai_analytics_readonly;

-- ── 7. Verification ──────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Sentient schema init complete.';
  RAISE NOTICE '  Schemas: hr_core, social, ai_agent';
  RAISE NOTICE '  Roles: hr_core_svc, social_svc, ai_agent_svc, ai_analytics_readonly';
  RAISE NOTICE '  Extension: vector (pgvector)';
END
$$;
