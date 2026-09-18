/**
 * Parses the standard OpenAI-compatible chat-completions streaming wire format:
 * repeated `data: <json>\n\n` frames terminated by a literal `data: [DONE]`.
 * Yields each frame's raw payload string (never the `[DONE]` sentinel itself,
 * never a keep-alive comment line) so the caller only ever sees real chunks.
 */
export async function* readSseDataLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice('data:'.length).trim();
          if (payload === '[DONE]') return;
          if (payload.length > 0) yield payload;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
