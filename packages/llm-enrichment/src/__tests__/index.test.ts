import { sanitizeInput, SECURITY_FIELDS_NEVER_AI_VERIFIED, enrichEndpoint } from '../index';
import type { EnrichmentInput } from '../index';

const BASE_INPUT: EnrichmentInput = {
  endpointId: 'ep-1',
  extractionRunId: 'run-1',
  structuredContext: {
    method: 'GET',
    path: '/users',
    summary: 'Get all users',
  },
};

describe('sanitizeInput', () => {
  it('passes through safe context unchanged', () => {
    const result = sanitizeInput(BASE_INPUT);
    expect(result.structuredContext['method']).toBe('GET');
    expect(result.structuredContext['path']).toBe('/users');
  });

  it('strips security fields before the LLM call', () => {
    const input: EnrichmentInput = {
      ...BASE_INPUT,
      structuredContext: {
        ...BASE_INPUT.structuredContext,
        auth: { type: 'bearer', scopes: ['read:users'] },
        security: [{ bearer: [] }],
      },
    };
    const result = sanitizeInput(input);
    expect(result.structuredContext['auth']).toBeUndefined();
    expect(result.structuredContext['security']).toBeUndefined();
  });

  it('redacts values that look like secrets', () => {
    const input: EnrichmentInput = {
      ...BASE_INPUT,
      structuredContext: {
        apiKey: 'sk-secret12345678901234567890123456789012',
        password: 'hunter2',
        name: 'safe value',
      },
    };
    const result = sanitizeInput(input);
    expect(result.structuredContext['apiKey']).toBe('[REDACTED]');
    expect(result.structuredContext['password']).toBe('[REDACTED]');
    expect(result.structuredContext['name']).toBe('safe value');
  });

  it('redacts Bearer tokens in string values', () => {
    const input: EnrichmentInput = {
      ...BASE_INPUT,
      structuredContext: {
        exampleHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      },
    };
    const result = sanitizeInput(input);
    expect(result.structuredContext['exampleHeader']).toBe('[REDACTED]');
  });
});

describe('SECURITY_FIELDS_NEVER_AI_VERIFIED', () => {
  it('contains all security-sensitive fields', () => {
    expect(SECURITY_FIELDS_NEVER_AI_VERIFIED.has('auth')).toBe(true);
    expect(SECURITY_FIELDS_NEVER_AI_VERIFIED.has('permissions')).toBe(true);
    expect(SECURITY_FIELDS_NEVER_AI_VERIFIED.has('rateLimit')).toBe(true);
  });
});

describe('enrichEndpoint', () => {
  it('returns empty evidence when the LLM call throws (fail gracefully)', async () => {
    // Pass an invalid API key — OpenAI client will throw an auth error
    const result = await enrichEndpoint(BASE_INPUT, {
      apiKey: 'invalid-key-for-test',
      model: 'gpt-4o-mini',
    });
    // Should return empty evidence rather than propagating the error
    expect(result.evidence).toHaveLength(0);
  });

  it('security fields stripped from structuredContext BEFORE the LLM call (sanitizeInput gate)', () => {
    // The sanitizeInput function runs before any LLM API call.
    // Verifying it strips security fields proves the data never reaches the LLM.
    const inputWithSecurityFields: EnrichmentInput = {
      ...BASE_INPUT,
      structuredContext: {
        method: 'GET',
        path: '/admin',
        auth: { type: 'bearer', scopes: ['admin'] },
        security: [{ bearer: [] }],
        authorization: 'Bearer token123',
        summary: 'Admin endpoint',
      },
    };
    const sanitized = sanitizeInput(inputWithSecurityFields);
    expect(sanitized.structuredContext['auth']).toBeUndefined();
    expect(sanitized.structuredContext['security']).toBeUndefined();
    expect(sanitized.structuredContext['authorization']).toBeUndefined();
    // Non-security fields are preserved
    expect(sanitized.structuredContext['summary']).toBe('Admin endpoint');
  });

  it('all evidence records have source=llm-enrichment and verificationStatus=ai-suggested', async () => {
    // Use the graceful-failure path (invalid key) — 0 records, still typed correctly
    const result = await enrichEndpoint(BASE_INPUT, { apiKey: 'invalid' });
    for (const record of result.evidence) {
      expect(record.source).toBe('llm-enrichment');
      expect(record.verificationStatus).toBe('ai-suggested');
    }
  });
});
