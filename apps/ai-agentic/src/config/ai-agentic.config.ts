import { registerAs } from '@nestjs/config';
import { parseHttpUrl, parseNonEmptyString, parsePositiveInt } from './validation';

export interface AiAgenticConfig {
  port: number;
  databaseUrl: string;
  hrCoreUrl: string;
  socialUrl: string;
  requestTimeoutMs: number;
  downstreamTimeoutMs: number;
  maxMessageChars: number;
  defaultPageSize: number;
  maxPageSize: number;
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
