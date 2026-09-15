/**
 * WHY: FR-023 requires protecting sensitive employee data in logs and final
 * responses. This redaction is intentionally conservative — emails and long
 * digit runs (phone numbers, national IDs) are masked, while short numbers
 * (leave-day counts, years inside ISO dates) stay readable so audit summaries
 * and leave answers remain useful.
 */
export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\b\d{6,}\b/g, '[redacted-number]');
}
