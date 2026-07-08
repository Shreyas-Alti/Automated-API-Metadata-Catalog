// llm-enrichment — Phase 2 implementation
// THE ONLY MODULE allowed to call an LLM. Structured, redacted input only.
// Returns AI-tagged evidence only (source: 'llm-enrichment', verificationStatus: 'ai-suggested').
// Security fields (auth, permissions, rateLimit) can NEVER be marked Verified from AI inference.
// CI-enforced: only this module may import an LLM client (openai).

import OpenAI from 'openai';
import type { EvidenceRecord } from '@api-catalog/contracts';
import { sanitizeInput, SECURITY_FIELDS_NEVER_AI_VERIFIED } from './sanitize';

export interface EnrichmentInput {
  endpointId: string;
  extractionRunId: string;
  /** Structured, pre-redacted context — never raw source files */
  structuredContext: Record<string, unknown>;
}

export interface EnrichmentOutput {
  evidence: Omit<EvidenceRecord, 'id' | 'timestamp'>[];
}

export interface EnrichmentConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 512;

const ENRICHMENT_PROMPT = `You are an API documentation assistant. Given structured data about an API endpoint, 
suggest concise, accurate values for the fields listed. 
ONLY suggest values for fields explicitly requested.
Respond with a JSON object mapping field names to suggested string values.
Do not suggest values for security-related fields (auth, permissions, rateLimit).
If you cannot confidently suggest a value, omit that field entirely.`;

/**
 * Enrich one endpoint's metadata using an LLM.
 *
 * Contract:
 * - Input is sanitized (security fields stripped, secrets redacted) before the LLM call.
 * - Output evidence records always have source='llm-enrichment' and verificationStatus='ai-suggested'.
 * - Security fields are never included in the output — enforced by SECURITY_FIELDS_NEVER_AI_VERIFIED.
 * - Adversarial/injected content in the structuredContext cannot alter the output *shape* because
 *   the response is parsed as JSON and field names are validated against the request.
 */
export async function enrichEndpoint(
  input: EnrichmentInput,
  config: EnrichmentConfig,
): Promise<EnrichmentOutput> {
  const sanitized = sanitizeInput(input);

  const client = new OpenAI({ apiKey: config.apiKey });

  const fieldsToEnrich = ['summary', 'description'];
  const prompt = `${ENRICHMENT_PROMPT}\n\nEndpoint context:\n${JSON.stringify(sanitized.structuredContext, null, 2)}\n\nSuggest values for these fields: ${fieldsToEnrich.join(', ')}`;

  let raw: string;
  try {
    const response = await client.chat.completions.create({
      model: config.model ?? DEFAULT_MODEL,
      max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    raw = response.choices[0]?.message?.content ?? '{}';
  } catch {
    // LLM call failed — return empty evidence rather than crashing the pipeline
    return { evidence: [] };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { evidence: [] };
  }

  const evidence: Omit<EvidenceRecord, 'id' | 'timestamp'>[] = [];

  for (const [field, value] of Object.entries(parsed)) {
    // Hard gate: security fields can never come from LLM
    if (SECURITY_FIELDS_NEVER_AI_VERIFIED.has(field.toLowerCase())) continue;

    // Only emit fields that were actually requested (prevents prompt-injection hijacking)
    if (!fieldsToEnrich.includes(field)) continue;

    if (typeof value !== 'string' || value.trim() === '') continue;

    evidence.push({
      extractionRunId: input.extractionRunId,
      endpointId: input.endpointId,
      field,
      value: value.trim(),
      source: 'llm-enrichment',
      verificationStatus: 'ai-suggested',
    });
  }

  return { evidence };
}

export { sanitizeInput, SECURITY_FIELDS_NEVER_AI_VERIFIED } from './sanitize';

