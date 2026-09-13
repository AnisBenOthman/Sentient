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

export interface PolicyCitation {
  sourceLabel: string;
  excerpt: string;
}

/** Mirrors ConfirmationPayloadResponse in apps/ai-agentic confirmation-card.presenter.ts. */
export interface ConfirmationPayload {
  confirmationToken: string;
  actionKind: 'LEAVE_BOOKING';
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  /** Advisory only — HR Core recomputes the exact count. */
  businessDays: number;
  currentBalance: number;
  balanceAfter: number;
  expiresAt: string;
  emotionalContext: 'NEUTRAL' | 'COMPASSIONATE_SICK' | null;
  /** Empty means policy was consulted and nothing relevant was found. */
  policyCitations: PolicyCitation[];
}

export type ActionOutcomeStatus =
  | 'SUCCESS' | 'UNVERIFIED' | 'FAILED' | 'REFUSED'
  | 'CANCELLED' | 'ALREADY_SUBMITTED' | 'EXPIRED' | 'NOT_FOUND';

/** Mirrors ActionOutcomeResponse in apps/ai-agentic confirmation-card.presenter.ts. */
export interface ActionOutcome {
  actionKind: 'LEAVE_BOOKING' | null;
  status: ActionOutcomeStatus;
  recordId: string | null;
  recordStatus: string | null;
  httpStatus: number | null;
  reason: string | null;
  verificationState: 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE' | null;
  summary: string;
}

export interface AiMessageResponse {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  content: string;
  agentType: string | null;
  status: AiAgentRunStatus;
  sourceContext: SourceContext[];
  createdAt: string;
  /** Present only while a booking proposal on this message is still awaiting Confirm/Cancel. */
  confirmationPayload?: ConfirmationPayload | null;
}

export interface ConversationTurnResponse {
  conversation: ConversationSummary;
  /** Null on confirm/cancel turns — a button tap is not a message. */
  userMessage: AiMessageResponse | null;
  assistantMessage: AiMessageResponse;
  routing: RoutingTrace;
  /** Present on confirm/cancel turns. */
  actionOutcome?: ActionOutcome;
}

export interface ConversationTurnRequest {
  message: string;
  clientContext?: Record<string, unknown>;
  /** Explicit decision on a pending proposal. Its presence is the only consent signal. */
  confirmed?: boolean;
  /** Required whenever `confirmed` is present. */
  confirmationToken?: string;
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
