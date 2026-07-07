import { computeQualityGate } from '../index';
import type { ExtractionResult, ValidationSummary } from '@api-catalog/contracts';

function makeResult(routes: ExtractionResult['routes'] = [], errors: ExtractionResult['errors'] = []): ExtractionResult {
  return { parserName: 'express', parserVersion: '1.0.0', capabilities: { routes: 'supported', models: 'not supported', middleware: 'not supported', auth: 'not supported', rateLimits: 'not supported' }, routes, schemas: {}, errors, warnings: [] };
}
const PASS_SUMMARY: ValidationSummary = { passed: true, errors: [], warnings: [] };
const FAIL_SUMMARY: ValidationSummary = { passed: false, errors: [{ kind: 'duplicate_route', message: 'dup' }], warnings: [] };

describe('quality-gates', () => {
  it('produces one score per endpoint', () => {
    const report = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/a' }, { method: 'POST', path: '/b' }]), validationSummary: PASS_SUMMARY });
    expect(report.endpointScores).toHaveLength(2);
  });

  it('overall outcome is reject when validation failed', () => {
    const report = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }]), validationSummary: FAIL_SUMMARY });
    expect(report.overallOutcome).toBe('reject');
  });

  it('overall outcome is human-review-required for a clean result (no auto-accept in Phase 1-2)', () => {
    const report = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }]), validationSummary: PASS_SUMMARY });
    expect(report.overallOutcome).toBe('human-review-required');
    // No outcome should ever be 'auto-accept' in Phase 1-2
    expect(report.endpointScores.every((s) => s.outcome !== 'auto-accept')).toBe(true);
  });

  it('route with security field is flagged hasSecurityField=true and always gets human-review', () => {
    const report = computeQualityGate({
      extractionResult: makeResult([{ method: 'GET', path: '/secure', security: [{ type: 'bearer' }] }]),
      validationSummary: PASS_SUMMARY,
    });
    expect(report.endpointScores[0]?.hasSecurityField).toBe(true);
    expect(report.endpointScores[0]?.outcome).toBe('human-review-required');
  });

  it('high parse error rate reduces score', () => {
    const manyErrors = Array.from({ length: 9 }, (_, i) => ({ file: `f${i}.ts`, message: 'err', kind: 'parse_error' as const }));
    const reportBad = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }], manyErrors), validationSummary: PASS_SUMMARY });
    const reportGood = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }], []), validationSummary: PASS_SUMMARY });
    expect(reportBad.endpointScores[0]?.score ?? 100).toBeLessThan(reportGood.endpointScores[0]?.score ?? 0);
  });

  it('security fields are permanently routed to human-review (hardcoded, not scored)', () => {
    // Even a perfect score doesn't auto-accept a security field
    const report = computeQualityGate({
      extractionResult: makeResult([{ method: 'POST', path: '/login', rateLimit: { requestsPerWindow: 5, windowSeconds: 60, source: 'middleware' } }]),
      validationSummary: PASS_SUMMARY,
    });
    expect(report.endpointScores[0]?.hasSecurityField).toBe(true);
    expect(report.endpointScores[0]?.outcome).toBe('human-review-required');
  });
});
