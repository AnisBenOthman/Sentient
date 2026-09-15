/**
 * WHY: Free models (e.g. Gemma) ignore "Return JSON only" and wrap output in
 * markdown fences like ```json ... ```. response_format: json_object would fix
 * it but many free models return 400 for that parameter. This extractor handles
 * both cases: raw JSON and fenced JSON, so JSON.parse never crashes.
 *
 * Shared by the intent classifier and the analytics SQL generator — both ask an
 * LLM for structured output over the same provider chain, so both hit the same
 * fencing behaviour.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Fast path: already valid JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence extraction
  }

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Last resort: find the first {...} block in the text
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(trimmed.slice(braceStart, braceEnd + 1));
  }

  throw new Error(`LLM response is not valid JSON: ${trimmed.slice(0, 120)}`);
}
