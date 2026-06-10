import { registerAs } from '@nestjs/config';
import { parseBoolean, parseHttpUrl, parseNonEmptyString, parseOptionalString, parsePositiveInt } from './validation';
import type { IntentClassifierProvider } from '../modules/agents/intent-classifier.types';

export interface AiAgenticConfig {
  port: number;
  databaseUrl: string;
  hrCoreUrl: string;
  socialUrl: string;
  intentClassifierProvider: IntentClassifierProvider;
  intentClassifierTimeoutMs: number;
  geminiApiKey: string | null;
  geminiApiUrl: string;
  geminiModel: string;
  intentClassifierDebugLogs: boolean;
  requestTimeoutMs: number;
  downstreamTimeoutMs: number;
  maxMessageChars: number;
  defaultPageSize: number;
  maxPageSize: number;
}

function parseIntentClassifierProvider(value: string | undefined): IntentClassifierProvider {
  const raw = (value ?? 'rules').trim().toLowerCase();
  if (raw === 'rules' || raw === 'gemini') return raw;
  throw new Error('AI_AGENT_INTENT_PROVIDER must be one of: rules, gemini');
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
    3_000,
    'AI_AGENT_INTENT_TIMEOUT_MS',
  ),
  geminiApiKey: parseOptionalString(process.env.GEMINI_API_KEY),
  geminiApiUrl: parseHttpUrl(
    process.env.GEMINI_API_URL,
    'https://generativelanguage.googleapis.com/v1beta',
    'GEMINI_API_URL',
  ),
  geminiModel: parseNonEmptyString(process.env.GEMINI_MODEL, 'gemini-2.5-flash-lite', 'GEMINI_MODEL'),
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
}));
