import type { EnrichmentInput } from './index';

// Fields that contain security-sensitive data — never sent to LLM
const SECURITY_FIELD_NAMES = new Set(['auth', 'security', 'authorization', 'permissions', 'rateLimit', 'rate_limit']);

// Keys whose values might contain secrets — redacted before sending
const REDACTED_KEYS = new Set(['password', 'secret', 'token', 'key', 'apiKey', 'api_key', 'credential']);

/**
 * Sanitize an EnrichmentInput before it is sent to the LLM.
 *
 * Rules:
 * 1. Remove any field in SECURITY_FIELD_NAMES — these are never LLM-inferred.
 * 2. Recursively redact values of REDACTED_KEYS in the structured context.
 * 3. Strip any property whose stringified value looks like a secret
 *    (bearer token pattern, base64-like long strings).
 *
 * Returns a new object — never mutates the input.
 */
export function sanitizeInput(input: EnrichmentInput): EnrichmentInput {
  const sanitizedContext = redactObject(input.structuredContext);
  return {
    endpointId: input.endpointId,
    extractionRunId: input.extractionRunId,
    structuredContext: sanitizedContext,
  };
}

function redactObject(obj: unknown): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Drop security-sensitive fields entirely
    if (SECURITY_FIELD_NAMES.has(key.toLowerCase())) continue;

    // Redact secret-looking values
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string' && looksLikeSecret(value)) {
      result[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Heuristic: bearer tokens, long base64-ish strings */
function looksLikeSecret(value: string): boolean {
  if (/^(Bearer|Basic|Token)\s+\S{20,}/i.test(value)) return true;
  if (value.length > 40 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return true;
  return false;
}

/**
 * Fields that are ALWAYS security-sensitive and can NEVER be marked
 * 'verified' by LLM inference, regardless of confidence.
 * This is a compile-time constant — do not change without architecture review.
 */
export const SECURITY_FIELDS_NEVER_AI_VERIFIED: ReadonlySet<string> = new Set([
  'auth',
  'permissions',
  'rateLimit',
  'rate_limit',
  'security',
  'authorization',
]);
