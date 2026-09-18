import { authStore } from '../auth';
import { refreshAccessToken } from './client';
import type { StreamDoneEvent } from './ai';

const gatewayBaseUrl = (import.meta.env.VITE_API_GATEWAY_URL ?? '').replace(/\/$/, '');
const aiApiBaseUrl = gatewayBaseUrl ? `${gatewayBaseUrl}/api/ai` : '/api/ai';

export interface OpenConversationStreamOptions {
  /** Relative to the AI gateway prefix, from ConversationTurnStreamingResponse.streaming.streamPath. */
  streamPath: string;
  onToken: (delta: string) => void;
  onDone: (event: StreamDoneEvent) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

interface SseFrame {
  event: string | null;
  data: string;
}

/** Parses `event: <name>\ndata: <json>\n\n` frames (NestJS's @Sse() wire format) out of a growing buffer. */
function extractFrames(buffer: string): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = [];
  let rest = buffer;
  let separatorIndex = rest.indexOf('\n\n');
  while (separatorIndex !== -1) {
    const raw = rest.slice(0, separatorIndex);
    rest = rest.slice(separatorIndex + 2);

    let event: string | null = null;
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
    }
    if (dataLines.length > 0) frames.push({ event, data: dataLines.join('\n') });

    separatorIndex = rest.indexOf('\n\n');
  }
  return { frames, rest };
}

async function requestStream(url: string, accessToken: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
}

/**
 * Opens the SSE turn stream via `fetch` (not native `EventSource`, which can
 * neither set an `Authorization` header nor be retried after a 401) and
 * dispatches parsed frames to the matching callback. Every exit path — open
 * failure, a mid-stream drop, or the reader ending without ever seeing `done`
 * or `error` — resolves through `onError` exactly once, never left hanging.
 */
export async function openConversationStream(options: OpenConversationStreamOptions): Promise<void> {
  const url = `${aiApiBaseUrl}${options.streamPath}`;
  const accessToken = authStore.getAccess();
  if (!accessToken) {
    options.onError('You need to sign in again to continue this conversation.');
    return;
  }

  let response: Response;
  try {
    response = await requestStream(url, accessToken, options.signal);
  } catch {
    options.onError('Could not connect to the assistant. Please try again.');
    return;
  }

  if (response.status === 401) {
    try {
      const refreshedToken = await refreshAccessToken();
      response = await requestStream(url, refreshedToken, options.signal);
    } catch {
      options.onError('Your session expired. Please sign in again.');
      return;
    }
  }

  if (!response.ok || !response.body) {
    options.onError('The assistant could not start responding. Please try again.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let settled = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const { frames, rest } = extractFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        if (frame.event === 'keep-alive') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(frame.data);
        } catch {
          continue;
        }
        if (frame.event === 'token') {
          options.onToken((parsed as { delta: string }).delta);
        } else if (frame.event === 'done') {
          settled = true;
          options.onDone(parsed as StreamDoneEvent);
        } else if (frame.event === 'error') {
          settled = true;
          options.onError((parsed as { message: string }).message);
        }
      }
    }
  } catch {
    if (!settled) options.onError('The connection to the assistant was interrupted.');
    return;
  } finally {
    reader.releaseLock();
  }

  if (!settled) options.onError('The assistant stopped responding unexpectedly.');
}
