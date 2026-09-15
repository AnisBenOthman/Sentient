-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_agent"."vector_documents" (
    "id" TEXT NOT NULL,
    "knowledge_item_id" TEXT,
    "source_type" "ai_agent"."KnowledgeSourceType" NOT NULL,
    "source_id" TEXT,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vector_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vector_documents_knowledge_item_id_chunk_index_idx" ON "ai_agent"."vector_documents"("knowledge_item_id", "chunk_index");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vector_documents_knowledge_item_id_fkey'
  ) THEN
    ALTER TABLE "ai_agent"."vector_documents"
      ADD CONSTRAINT "vector_documents_knowledge_item_id_fkey"
      FOREIGN KEY ("knowledge_item_id")
      REFERENCES "ai_agent"."knowledge_items"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ai_agent TO ai_agent_svc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ai_agent TO ai_agent_svc;
