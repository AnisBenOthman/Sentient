-- Verbatim SQL produced by the analytics Text-to-SQL branch.
-- WHY a dedicated column instead of reusing input_summary/output_summary: those pass
-- through redactSensitiveText, which rewrites \d{6,} to [redacted-number] and would
-- silently corrupt salary thresholds and date literals inside the statement. The
-- generated SQL is the forensic record of what the model ran against HR data, so it
-- must be stored exactly as executed. It references only hr_analytics view names and
-- literals drawn from the user's own question — never fetched PII.
ALTER TABLE "ai_agent"."agent_task_logs"
  ADD COLUMN "generated_sql" TEXT;
