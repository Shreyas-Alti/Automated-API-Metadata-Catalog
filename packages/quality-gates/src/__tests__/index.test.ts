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

  it('overall outcome is human-review-required for a well-formed route (no auto-accept in Phase 1-2)', () => {
    // A route with sourceLocation + responses is "complete" and scores above the reject band
    const report = computeQualityGate({
      extractionResult: makeResult([{
        method: 'GET', path: '/x',
        sourceLocation: { file: 'app.ts', line: 10 },
        responses: [{ statusCode: '200' }],
      }]),
      validationSummary: PASS_SUMMARY,
    });
    expect(report.overallOutcome).toBe('human-review-required');
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

  // ── THE KEY TEST: per-endpoint scores must differ based on per-route signals ──
  it('a complete endpoint scores higher than a bare endpoint IN THE SAME RUN', () => {
    // Two endpoints in the same run: one fully specified, one bare method+path only.
    // They must receive DIFFERENT scores — otherwise per-endpoint scoring is a no-op.
    const report = computeQualityGate({
      extractionResult: makeResult([
        // Bare route: no responses, no sourceLocation, no body
        { method: 'POST', path: '/bare' },
        // Complete route: has sourceLocation, responses, and requestBody
        {
          method: 'POST',
          path: '/complete',
          sourceLocation: { file: 'src/routes.ts', line: 10 },
          responses: [{ statusCode: '200', content: { 'application/json': { schema: { type: 'object' } } } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        },
      ]),
      validationSummary: PASS_SUMMARY,
    });

    const bareScore = report.endpointScores.find((s) => s.endpointPath === '/bare')?.score ?? 0;
    const completeScore = report.endpointScores.find((s) => s.endpointPath === '/complete')?.score ?? 0;

    // They must differ — per-endpoint scoring is only meaningful if routes score differently
    expect(completeScore).toBeGreaterThan(bareScore);

    // fieldCompletenessRatio must also differ between endpoints in the signals
    const bareSignals = report.endpointScores.find((s) => s.endpointPath === '/bare')?.signals;
    const completeSignals = report.endpointScores.find((s) => s.endpointPath === '/complete')?.signals;
    expect(completeSignals?.fieldCompletenessRatio).toBeGreaterThan(bareSignals?.fieldCompletenessRatio ?? 1);
  });

  it('high parse error rate reduces score for all endpoints in the run', () => {
    const manyErrors = Array.from({ length: 9 }, (_, i) => ({ file: `f${i}.ts`, message: 'err', kind: 'parse_error' as const }));
    const reportBad = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }], manyErrors), validationSummary: PASS_SUMMARY });
    const reportGood = computeQualityGate({ extractionResult: makeResult([{ method: 'GET', path: '/x' }], []), validationSummary: PASS_SUMMARY });
    expect(reportBad.endpointScores[0]?.score ?? 100).toBeLessThan(reportGood.endpointScores[0]?.score ?? 0);
  });

  it('security fields are permanently routed to human-review (hardcoded, not scored)', () => {
    const report = computeQualityGate({
      extractionResult: makeResult([{ method: 'POST', path: '/login', rateLimit: { requestsPerWindow: 5, windowSeconds: 60, source: 'middleware' } }]),
      validationSummary: PASS_SUMMARY,
    });
    expect(report.endpointScores[0]?.hasSecurityField).toBe(true);
    expect(report.endpointScores[0]?.outcome).toBe('human-review-required');
  });
});
