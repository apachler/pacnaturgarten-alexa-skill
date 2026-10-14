/**
 * One JSON line per event in CloudWatch. Never pass tokens, Authorization headers or full
 * Alexa ids: callers log only what is listed here, and `redact()` masks anything token-shaped
 * that slips into a message anyway.
 */
const TOKEN_LIKE = /\b(ngb(?:at|rt|ac)_[A-Za-z0-9_]+|ngb_(?:live|test)_[A-Za-z0-9_]+|Atza\|[^\s"]+|Bearer\s+[^\s"]+)/g;

export const redact = (text: string): string => text.replace(TOKEN_LIKE, '[redacted]');

export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(redact(JSON.stringify({ event, ...fields })));
}
