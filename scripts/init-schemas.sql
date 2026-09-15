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

-- WHY: hr_analytics holds curated read-only VIEWS over hr_core, and is the ONLY
-- surface the Text-to-SQL analytics role can reach. Views are owned by hr_core_svc
-- so they read base tables with owner privileges, while ai_analytics_readonly holds
-- no base-table grant at all. See apps/hr-core/prisma/migrations/*_ai_analytics_views.
CREATE SCHEMA IF NOT EXISTS hr_analytics;

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
GRANT CREATE ON SCHEMA ai_agent TO ai_agent_svc;

-- hr_analytics: hr_core_svc creates and owns the views (Prisma migration runs as this
-- role); ai_analytics_readonly may only look inside the schema, never create in it.
GRANT USAGE, CREATE ON SCHEMA hr_analytics TO hr_core_svc;
GRANT USAGE ON SCHEMA hr_analytics TO ai_analytics_readonly;

-- WHY NO hr_core GRANT: the analytics role must never reach base tables. It sees
-- hr_core data exclusively through the scope-filtered views in hr_analytics, which
-- strip PII, apply soft-delete filters, and enforce row scoping via session variables.
-- REVOKE is explicit (not merely "absent") so re-running this script repairs a database
-- where the old, broader grant was applied.
REVOKE ALL ON SCHEMA hr_core FROM ai_analytics_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA hr_core FROM ai_analytics_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE hr_core_svc IN SCHEMA hr_core
  REVOKE ALL ON TABLES FROM ai_analytics_readonly;

-- Deny the default writable namespace and temp-table creation. TRANSACTION READ ONLY
-- already blocks writes; these make it true at the privilege level too.
-- The database name is resolved at runtime so this script works against any target.
REVOKE ALL ON SCHEMA public FROM ai_analytics_readonly;
DO $$
BEGIN
  EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM ai_analytics_readonly', current_database());
END
$$;

-- ── 5. Table privileges on existing tables ───────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr_core TO hr_core_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr_core TO hr_core_svc;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA social TO social_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA social TO social_svc;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai_agent TO ai_agent_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ai_agent TO ai_agent_svc;

-- Analytics role gets NO table privileges here — see the hr_analytics grants above.
-- (The previous `GRANT SELECT ON ALL TABLES IN SCHEMA hr_core` was also a no-op: it ran
-- before Prisma had created any table, and the matching ALTER DEFAULT PRIVILEGES omitted
-- `FOR ROLE hr_core_svc`, so it never applied to tables Prisma creates.)

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

-- Analytics readonly: intentionally no default privileges. Every view it may read is
-- granted explicitly by the ai_analytics_views migration, so adding a table is not
-- silently readable by the LLM-driven query path.

-- ── 7. Verification ──────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Sentient schema init complete.';
  RAISE NOTICE '  Schemas: hr_core, social, ai_agent, hr_analytics';
  RAISE NOTICE '  Roles: hr_core_svc, social_svc, ai_agent_svc, ai_analytics_readonly';
  RAISE NOTICE '  Extension: vector (pgvector)';
END
$$;
