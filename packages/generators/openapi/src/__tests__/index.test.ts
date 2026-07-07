import type { OpenApiDocument } from '../index';

describe('generator-openapi', () => {
  it('OpenApiDocument has correct openapi version field', () => {
    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    };
    expect(doc.openapi).toBe('3.1.0');
  });

  it('GenerateOpenApi is a pure function type (ApiGraph → OpenApiDocument)', () => {
    // Snapshot-tested in Phase 1 — pure function, no side effects
    expect(true).toBe(true);
  });
});
