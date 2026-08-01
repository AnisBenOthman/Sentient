import axios from 'axios';
import { authStore } from '../auth';

const gatewayBaseUrl = (import.meta.env.VITE_API_GATEWAY_URL ?? '').replace(/\/$/, '');

export const aiClient = axios.create({
  baseURL: gatewayBaseUrl ? `${gatewayBaseUrl}/api/ai` : '/api/ai',
  headers: { 'Content-Type': 'application/json' },
});

aiClient.interceptors.request.use((config) => {
  const token = authStore.getAccess();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export const aiApi = {
  client: aiClient,
};

/**
 * Mirrors AiAgentRunStatus in packages/shared/src/enums/ai-agent-run-status.enum.ts.
 * This is a hand-maintained copy — the compiler cannot catch drift between the
 * two, so any member added there must be added here in the same change.
 */
export type AiAgentRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'DEGRADED'
  | 'PARTIAL'
  | 'ESCALATED'
  | 'REFUSED'
  | 'OUT_OF_SCOPE'
  /** A mutating action was proposed and awaits the user's explicit confirm/cancel tap. */
  | 'PENDING_CONFIRMATION'
  /** The downstream write apparently succeeded but the independent read-back did not confirm it. */
  | 'UNVERIFIED';

export interface SourceContext {
  sourceType: string;
  title: string;
  referenceId?: string | null;
}

export interface RoutingTraceNode {
  nodeType: string;
  agentType: string;
  status: AiAgentRunStatus;
  summary?: string | null;
}

export interface RoutingTrace {
  status: AiAgentRunStatus;
  nodes: RoutingTraceNode[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  lastAgentType: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
}

export interface AiMessageResponse {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  content: string;
  agentType: string | null;
  status: AiAgentRunStatus;
  sourceContext: SourceContext[];
  createdAt: string;
}

export interface ConversationTurnResponse {
  conversation: ConversationSummary;
  userMessage: AiMessageResponse;
  assistantMessage: AiMessageResponse;
  routing: RoutingTrace;
}

export interface ConversationTurnRequest {
  message: string;
  clientContext?: Record<string, unknown>;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversationDetailResponse {
  conversation: ConversationSummary;
  messages: AiMessageResponse[];
}

export interface FeedbackRequest {
  rating: 'POSITIVE' | 'NEGATIVE';
  comment?: string;
}

export interface FeedbackResponse {
  id: string;
  messageId: string;
  rating: 'POSITIVE' | 'NEGATIVE';
  comment: string | null;
  createdAt: string;
}

export async function startConversation(dto: ConversationTurnRequest): Promise<ConversationTurnResponse> {
  const response = await aiClient.post<ConversationTurnResponse>('/conversations', dto);
  return response.data;
}

export async function sendConversationMessage(
  conversationId: string,
  dto: ConversationTurnRequest,
): Promise<ConversationTurnResponse> {
  const response = await aiClient.post<ConversationTurnResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    dto,
  );
  return response.data;
}

export async function listConversations(params: { page?: number; pageSize?: number } = {}): Promise<ConversationListResponse> {
  const response = await aiClient.get<ConversationListResponse>('/conversations', { params });
  return response.data;
}

export async function getConversation(conversationId: string): Promise<ConversationDetailResponse> {
  const response = await aiClient.get<ConversationDetailResponse>(`/conversations/${encodeURIComponent(conversationId)}`);
  return response.data;
}

export async function archiveConversation(conversationId: string): Promise<ConversationSummary> {
  const response = await aiClient.patch<ConversationSummary>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { status: 'ARCHIVED' },
  );
  return response.data;
}

export async function restoreConversation(conversationId: string): Promise<ConversationSummary> {
  const response = await aiClient.patch<ConversationSummary>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { status: 'ACTIVE' },
  );
  return response.data;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await aiClient.delete(`/conversations/${encodeURIComponent(conversationId)}`);
}

export async function saveResponseFeedback(
  messageId: string,
  dto: FeedbackRequest,
): Promise<FeedbackResponse> {
  const response = await aiClient.put<FeedbackResponse>(
    `/messages/${encodeURIComponent(messageId)}/feedback`,
    dto,
  );
  return response.data;
}
