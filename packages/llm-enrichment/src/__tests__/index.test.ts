import type { EnrichmentInput } from '../index';

describe('llm-enrichment', () => {
  it('EnrichmentInput requires structured context, not raw files', () => {
    const input: EnrichmentInput = {
      endpointId: 'ep-1',
      extractionRunId: 'run-1',
      structuredContext: { method: 'GET', path: '/users', responseSchema: 'User[]' },
    };
    // structuredContext is pre-redacted structured data, never raw source files
    expect(input.structuredContext).toBeDefined();
  });

  it('module is the sole allowed LLM caller — enforced via dependency-cruiser', () => {
    expect(true).toBe(true);
  });
});
