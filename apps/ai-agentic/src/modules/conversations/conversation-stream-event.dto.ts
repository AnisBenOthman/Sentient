import { ConversationSummaryResponse, MessageResponse } from './conversation-response.mapper';
import { RoutingTrace } from '../../common/dto';

export interface TokenStreamEventData {
  turnId: string;
  delta: string;
}

export interface DoneStreamEventData {
  turnId: string;
  conversation: ConversationSummaryResponse;
  assistantMessage: MessageResponse;
  routing: RoutingTrace;
}

export interface ErrorStreamEventData {
  turnId: string;
  message: string;
}

export interface KeepAliveStreamEventData {
  at: string;
}
