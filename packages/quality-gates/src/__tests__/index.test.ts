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
    // Use capabilities that include response + middleware support so the
    // per-route response and body checks are active for this test.
    const reportWithResponseCapability = computeQualityGate({
      extractionResult: {
        parserName: 'express', parserVersion: '2.0.0',
        capabilities: {
          routes: 'supported',
          models: 'supported',       // response check IS active
          middleware: 'supported',   // body check IS active
          auth: 'not supported',
          rateLimits: 'not supported',
        },
        routes: [
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
        ],
        schemas: {}, errors: [], warnings: [],
      },
      validationSummary: PASS_SUMMARY,
    });

    const bareScore = reportWithResponseCapability.endpointScores.find((s) => s.endpointPath === '/bare')?.score ?? 0;
    const completeScore = reportWithResponseCapability.endpointScores.find((s) => s.endpointPath === '/complete')?.score ?? 0;

    expect(completeScore).toBeGreaterThan(bareScore);

    const bareSignals = reportWithResponseCapability.endpointScores.find((s) => s.endpointPath === '/bare')?.signals;
    const completeSignals = reportWithResponseCapability.endpointScores.find((s) => s.endpointPath === '/complete')?.signals;
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
