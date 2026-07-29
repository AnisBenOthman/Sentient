-- Enhancement migration: pgvector retrieval, per-call token telemetry,
-- rolling conversation summaries.

-- Token usage per AgentTaskLog (summed across LLM rounds for the task).
ALTER TABLE "ai_agent"."agent_task_logs" ADD COLUMN IF NOT EXISTS "tokens_in" INTEGER;
ALTER TABLE "ai_agent"."agent_task_logs" ADD COLUMN IF NOT EXISTS "tokens_out" INTEGER;

-- Rolling conversation summary for context beyond the recent-message window.
ALTER TABLE "ai_agent"."conversations" ADD COLUMN IF NOT EXISTS "context_summary" TEXT;
ALTER TABLE "ai_agent"."conversations" ADD COLUMN IF NOT EXISTS "summarized_message_count" INTEGER NOT NULL DEFAULT 0;

-- Real vector column for ANN retrieval (Gemini text-embedding-004 = 768 dims).
-- The legacy JSONB "embedding" column is kept untouched for backward compatibility.
--
-- WHY conditional: the docker pgvector/pgvector:pg16 image ships the extension,
-- but local PostgreSQL installs (e.g. Windows PG15) may not have it. Retrieval
-- code detects the missing column at runtime and falls back to keyword search,
-- so skipping the vector DDL keeps the migration deployable everywhere.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE 'ALTER TABLE "ai_agent"."vector_documents" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(768)';
    -- HNSW cosine index: filter-first hybrid queries stay fast as the corpus grows.
    EXECUTE 'CREATE INDEX IF NOT EXISTS "vector_documents_embedding_vec_idx"
      ON "ai_agent"."vector_documents"
      USING hnsw ("embedding_vec" vector_cosine_ops)';
  ELSE
    RAISE NOTICE 'pgvector extension not available on this server — knowledge retrieval will use the keyword fallback until the database runs the pgvector image (docker compose pgvector/pgvector:pg16).';
  END IF;
END
$$;
