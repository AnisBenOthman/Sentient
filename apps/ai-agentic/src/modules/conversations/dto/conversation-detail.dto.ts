import { ConversationSummaryResponse, MessageResponse } from '../conversation-response.mapper';

export interface ConversationDetailResponse {
  conversation: ConversationSummaryResponse;
  messages: MessageResponse[];
}
