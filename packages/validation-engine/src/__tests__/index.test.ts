import {
  validate,
  checkDuplicateRoutes,
  checkOrphanSchemas,
  checkMissingBodies,
  checkInvalidRefs,
} from '../index';
import type { ExtractionResult } from '@api-catalog/contracts';

function makeResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    parserName: 'express', parserVersion: '1.0.0',
    capabilities: { routes: 'supported', models: 'not supported', middleware: 'not supported', auth: 'not supported', rateLimits: 'not supported' },
    routes: [], schemas: {}, errors: [], warnings: [],
    ...overrides,
  };
}

describe('checkDuplicateRoutes', () => {
  it('PASS — unique routes produce no errors', () => {
    expect(checkDuplicateRoutes(makeResult({ routes: [{ method: 'GET', path: '/a' }, { method: 'POST', path: '/a' }] }))).toHaveLength(0);
  });
  it('FAIL — two identical (method, path) pairs', () => {
    const errors = checkDuplicateRoutes(makeResult({ routes: [{ method: 'GET', path: '/dup' }, { method: 'GET', path: '/dup' }] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.kind).toBe('duplicate_route');
  });
});

describe('checkOrphanSchemas', () => {
  it('PASS — all $refs resolve', () => {
    expect(checkOrphanSchemas(makeResult({
      routes: [{ method: 'GET', path: '/x', responses: [{ statusCode: '200', content: { 'application/json': { schema: { $ref: '#/components/schemas/X' } } } }] }],
      schemas: { X: { type: 'object' } },
    }))).toHaveLength(0);
  });
  it('FAIL — $ref points to non-existent schema', () => {
    const errors = checkOrphanSchemas(makeResult({
      routes: [{ method: 'GET', path: '/x', responses: [{ statusCode: '200', content: { 'application/json': { schema: { $ref: '#/components/schemas/Missing' } } } }] }],
    }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.kind).toBe('orphan_schema');
  });
});

describe('checkMissingBodies', () => {
  it('PASS — POST with a requestBody defined', () => {
    expect(checkMissingBodies(makeResult({ routes: [{ method: 'POST', path: '/x', requestBody: { required: true, content: {} } }] }))).toHaveLength(0);
  });
  it('WARN — POST without a requestBody', () => {
    const warnings = checkMissingBodies(makeResult({ routes: [{ method: 'POST', path: '/x' }] }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe('missing_request_body');
  });
  it('PASS — GET and DELETE do not require a body', () => {
    expect(checkMissingBodies(makeResult({ routes: [{ method: 'GET', path: '/x' }, { method: 'DELETE', path: '/x' }] }))).toHaveLength(0);
  });
});

describe('checkInvalidRefs', () => {
  it('PASS — valid #/ ref', () => {
    expect(checkInvalidRefs(makeResult({ schemas: { X: { $ref: '#/components/schemas/Y' } }, routes: [] }))).toHaveLength(0);
  });
  it('FAIL — malformed ref without leading #/', () => {
    const errors = checkInvalidRefs(makeResult({ routes: [{ method: 'GET', path: '/x', responses: [{ statusCode: '200', content: { 'application/json': { schema: { $ref: 'bad/ref' } } } }] }] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.kind).toBe('invalid_ref');
  });
});

describe('validate', () => {
  it('returns passed=true for a clean result', () => {
    const s = validate(makeResult({ routes: [{ method: 'GET', path: '/ok' }] }));
    expect(s.passed).toBe(true);
    expect(s.errors).toHaveLength(0);
  });
  it('returns passed=false when errors exist', () => {
    const s = validate(makeResult({ routes: [{ method: 'GET', path: '/d' }, { method: 'GET', path: '/d' }] }));
    expect(s.passed).toBe(false);
  });
  it('passed=true even with warnings (missing body is a warning only)', () => {
    const s = validate(makeResult({ routes: [{ method: 'POST', path: '/x' }] }));
    expect(s.passed).toBe(true);
    expect(s.warnings.length).toBeGreaterThan(0);
  });
});
