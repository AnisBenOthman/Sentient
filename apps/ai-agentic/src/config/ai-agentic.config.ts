import { registerAs } from '@nestjs/config';
import { parseBoolean, parseHttpUrl, parseNonEmptyString, parseOptionalString, parsePositiveInt, parseRatio } from './validation';
import type { IntentClassifierProvider } from '../modules/agents/intent-classifier.types';
import { AgentType } from '../generated/prisma';

export interface AiAgenticConfig {
  port: number;
  databaseUrl: string;
  hrCoreUrl: string;
  socialUrl: string;
  intentClassifierProvider: IntentClassifierProvider;
  intentClassifierTimeoutMs: number;
  intentConfidenceThreshold: number;
  intentScopeOverrideThreshold: number;
  geminiApiKey: string | null;
  geminiApiUrl: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
  geminiThinkingLevel: string;
  /** Comma-separated provider priority order, e.g. ['GEMINI', 'OPENROUTER']. */
  llmProviderOrder: string[];
  openRouterApiKey: string | null;
  openRouterApiUrl: string;
  openRouterModel: string;
  groqApiKey: string | null;
  groqApiUrl: string;
  groqModel: string;
  xaiApiKey: string | null;
  xaiApiUrl: string;
  xaiModel: string;
  intentClassifierDebugLogs: boolean;
  requestTimeoutMs: number;
  downstreamTimeoutMs: number;
  maxMessageChars: number;
  defaultPageSize: number;
  maxPageSize: number;
  /** Connection string for the SELECT-only role used by the Text-to-SQL branch. */
  analyticsDatabaseUrl: string;
  /** Ships false: merging the analytics SQL branch is inert until explicitly enabled. */
  analyticsSqlEnabled: boolean;
  analyticsSqlRowLimit: number;
  analyticsSqlTimeoutMs: number;
  /** Confirmation-token lifetime for a proposed mutating action (FR-004). */
  actionTokenTtlMinutes: number;
  /** Delay before a sick-leave wellness follow-up fires (FR-033). */
  followUpDelayHours: number;
  /** A due follow-up older than this after downtime is suppressed rather than sent late (FR-038). */
  followUpStaleAfterHours: number;
  /** Ships false: token-by-token streaming is inert until explicitly enabled. */
  streamingEnabled: boolean;
  /** Only a turn resolving to exactly one of these specialists is stream-eligible. */
  streamingAgentTypes: AgentType[];
  /** How long an unclaimed pending streaming turn survives before the sweeper drops it. */
  streamingTurnTtlMs: number;
  /** SSE keep-alive interval — must stay well under the request-timeout window. */
  streamingKeepAliveMs: number;
}

function parseIntentClassifierProvider(value: string | undefined): IntentClassifierProvider {
  const raw = (value ?? 'rules').trim().toLowerCase();
  if (raw === 'rules' || raw === 'gemini' || raw === 'openrouter' || raw === 'groq') return raw;
  throw new Error('AI_AGENT_INTENT_PROVIDER must be one of: rules, gemini, openrouter, groq');
}

/**
 * WHY: Users sometimes copy the full cURL endpoint from the Gemini docs
 * (e.g. ".../v1beta/models/gemini-2.5-flash:generateContent") and paste it
 * as GEMINI_API_URL. Strip everything from /models/ onward so the service
 * always works with the bare API root regardless of what was pasted.
 */
function parseGeminiApiUrl(value: string | undefined): string {
  const url = parseHttpUrl(value, 'https://generativelanguage.googleapis.com/v1beta', 'GEMINI_API_URL');
  const cut = url.indexOf('/models/');
  return cut === -1 ? url : url.slice(0, cut);
}

function parseProviderOrder(value: string | undefined): string[] {
  const raw = (value ?? 'GEMINI').trim();
  return raw.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0);
}

/**
 * WHY silently drop an unrecognized entry rather than throw: this list only ever
 * narrows what can stream — an operator typo here should degrade to "that agent
 * doesn't stream" (the existing complete-answer flow), never crash the service.
 */
function parseStreamingAgentTypes(value: string | undefined): AgentType[] {
  const raw = (value ?? 'LEAVE_AGENT,GENERAL_HELP_AGENT').trim();
  const known = new Set<string>(Object.values(AgentType));
  return raw
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is AgentType => known.has(entry));
}

export const aiAgenticConfig = registerAs('aiAgentic', (): AiAgenticConfig => ({
  port: parsePositiveInt(process.env.AI_AGENT_PORT, 3003, 'AI_AGENT_PORT'),
  databaseUrl: parseNonEmptyString(
    process.env.AI_AGENT_DATABASE_URL,
    'postgresql://ai_agent_svc:ai_pass@localhost:5432/sentient?schema=ai_agent',
    'AI_AGENT_DATABASE_URL',
  ),
  hrCoreUrl: parseHttpUrl(process.env.HR_CORE_URL, 'http://localhost:3001', 'HR_CORE_URL'),
  socialUrl: parseHttpUrl(process.env.SOCIAL_URL, 'http://localhost:3002', 'SOCIAL_URL'),
  intentClassifierProvider: parseIntentClassifierProvider(process.env.AI_AGENT_INTENT_PROVIDER),
  intentClassifierTimeoutMs: parsePositiveInt(
    process.env.AI_AGENT_INTENT_TIMEOUT_MS,
    5_000,
    'AI_AGENT_INTENT_TIMEOUT_MS',
  ),
  intentConfidenceThreshold: parseRatio(
    process.env.AI_AGENT_INTENT_CONFIDENCE_THRESHOLD,
    0.4,
    'AI_AGENT_INTENT_CONFIDENCE_THRESHOLD',
  ),
  intentScopeOverrideThreshold: parseRatio(
    process.env.AI_AGENT_SCOPE_OVERRIDE_THRESHOLD,
    0.7,
    'AI_AGENT_SCOPE_OVERRIDE_THRESHOLD',
  ),
  geminiApiKey: parseOptionalString(process.env.GEMINI_API_KEY),
  geminiApiUrl: parseGeminiApiUrl(process.env.GEMINI_API_URL),
  geminiModel: parseNonEmptyString(process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'GEMINI_MODEL'),
  // WHY: must produce 768-dim vectors — the vector_documents.embedding_vec column is vector(768).
  geminiEmbeddingModel: parseNonEmptyString(
    process.env.GEMINI_EMBEDDING_MODEL,
    'text-embedding-004',
    'GEMINI_EMBEDDING_MODEL',
  ),
  geminiThinkingLevel: parseNonEmptyString(process.env.GEMINI_THINKING_LEVEL, 'medium', 'GEMINI_THINKING_LEVEL'),
  llmProviderOrder: parseProviderOrder(process.env.AI_AGENT_LLM_PROVIDER_ORDER),
  openRouterApiKey: parseOptionalString(process.env.OPENROUTER_API_KEY),
  openRouterApiUrl: parseHttpUrl(
    process.env.OPENROUTER_API_URL,
    'https://openrouter.ai/api/v1',
    'OPENROUTER_API_URL',
  ),
  openRouterModel: parseNonEmptyString(process.env.OPENROUTER_MODEL, 'openrouter/auto', 'OPENROUTER_MODEL'),
  groqApiKey: parseOptionalString(process.env.GROQ_API_KEY),
  groqApiUrl: parseHttpUrl(process.env.GROQ_API_URL, 'https://api.groq.com/openai/v1', 'GROQ_API_URL'),
  groqModel: parseNonEmptyString(process.env.GROQ_MODEL, 'llama-3.1-8b-instant', 'GROQ_MODEL'),
  xaiApiKey: parseOptionalString(process.env.XAI_API_KEY),
  xaiApiUrl: parseHttpUrl(process.env.XAI_API_URL, 'https://api.x.ai/v1', 'XAI_API_URL'),
  xaiModel: parseNonEmptyString(process.env.XAI_MODEL, 'grok-2-latest', 'XAI_MODEL'),
  intentClassifierDebugLogs: parseBoolean(
    process.env.AI_AGENT_INTENT_DEBUG_LOGS,
    false,
    'AI_AGENT_INTENT_DEBUG_LOGS',
  ),
  requestTimeoutMs: parsePositiveInt(
    process.env.AI_AGENT_REQUEST_TIMEOUT_MS ?? process.env.REQUEST_TIMEOUT_MS,
    60_000,
    'AI_AGENT_REQUEST_TIMEOUT_MS',
  ),
  downstreamTimeoutMs: parsePositiveInt(
    process.env.AI_AGENT_DOWNSTREAM_TIMEOUT_MS,
    8_000,
    'AI_AGENT_DOWNSTREAM_TIMEOUT_MS',
  ),
  maxMessageChars: parsePositiveInt(
    process.env.AI_AGENT_MAX_MESSAGE_CHARS,
    8_000,
    'AI_AGENT_MAX_MESSAGE_CHARS',
  ),
  defaultPageSize: parsePositiveInt(
    process.env.AI_AGENT_DEFAULT_PAGE_SIZE,
    20,
    'AI_AGENT_DEFAULT_PAGE_SIZE',
  ),
  maxPageSize: parsePositiveInt(
    process.env.AI_AGENT_MAX_PAGE_SIZE,
    100,
    'AI_AGENT_MAX_PAGE_SIZE',
  ),
  // WHY parseNonEmptyString and not parseHttpUrl: parseHttpUrl rejects the
  // postgresql:// scheme. Follows the databaseUrl precedent above.
  analyticsDatabaseUrl: parseNonEmptyString(
    process.env.AI_ANALYTICS_DATABASE_URL,
    'postgresql://ai_analytics_readonly:readonly_pass@localhost:5432/sentient?schema=hr_analytics',
    'AI_ANALYTICS_DATABASE_URL',
  ),
  analyticsSqlEnabled: parseBoolean(
    process.env.AI_AGENT_ANALYTICS_SQL_ENABLED,
    false,
    'AI_AGENT_ANALYTICS_SQL_ENABLED',
  ),
  analyticsSqlRowLimit: parsePositiveInt(
    process.env.AI_AGENT_ANALYTICS_SQL_ROW_LIMIT,
    1_000,
    'AI_AGENT_ANALYTICS_SQL_ROW_LIMIT',
  ),
  analyticsSqlTimeoutMs: parsePositiveInt(
    process.env.AI_AGENT_ANALYTICS_SQL_TIMEOUT_MS,
    5_000,
    'AI_AGENT_ANALYTICS_SQL_TIMEOUT_MS',
  ),
  actionTokenTtlMinutes: parsePositiveInt(
    process.env.AI_AGENT_ACTION_TOKEN_TTL_MINUTES,
    15,
    'AI_AGENT_ACTION_TOKEN_TTL_MINUTES',
  ),
  followUpDelayHours: parsePositiveInt(
    process.env.AI_AGENT_FOLLOWUP_DELAY_HOURS,
    48,
    'AI_AGENT_FOLLOWUP_DELAY_HOURS',
  ),
  followUpStaleAfterHours: parsePositiveInt(
    process.env.AI_AGENT_FOLLOWUP_STALE_AFTER_HOURS,
    24,
    'AI_AGENT_FOLLOWUP_STALE_AFTER_HOURS',
  ),
  streamingEnabled: parseBoolean(
    process.env.AI_AGENT_STREAMING_ENABLED,
    false,
    'AI_AGENT_STREAMING_ENABLED',
  ),
  streamingAgentTypes: parseStreamingAgentTypes(process.env.AI_AGENT_STREAMING_AGENT_TYPES),
  streamingTurnTtlMs: parsePositiveInt(
    process.env.AI_AGENT_STREAMING_TURN_TTL_MS,
    120_000,
    'AI_AGENT_STREAMING_TURN_TTL_MS',
  ),
  streamingKeepAliveMs: parsePositiveInt(
    process.env.AI_AGENT_STREAMING_KEEPALIVE_MS,
    15_000,
    'AI_AGENT_STREAMING_KEEPALIVE_MS',
  ),
}));
