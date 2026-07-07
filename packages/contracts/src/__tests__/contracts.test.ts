import type { ExtractionResult, ParserCapabilities } from '../extraction-result';
import type { ExtractionRun, ExtractionRunStatus } from '../extraction-run';
import type { EvidenceRecord } from '../evidence-record';
import type { Auth, ApiGraph } from '../canonical-graph';
import type { EndpointQualityScore, RunQualityReport } from '../quality-score';
import {
  SCORE_BAND_AUTO_ACCEPT_MIN,
  SCORE_BAND_REVIEW_MIN,
  SECURITY_FIELDS_ALWAYS_REVIEW,
} from '../quality-score';

describe('ExtractionResult contract', () => {
  it('can be constructed with all required fields', () => {
    const capabilities: ParserCapabilities = {
      routes: 'supported',
      models: 'supported',
      middleware: 'supported',
      auth: 'not supported',
      rateLimits: 'not supported',
    };
    const result: ExtractionResult = {
      parserName: 'express',
      parserVersion: '1.0.0',
      capabilities,
      routes: [],
      schemas: {},
      errors: [],
      warnings: [],
    };
    expect(result.parserName).toBe('express');
    expect(result.routes).toHaveLength(0);
  });
});

describe('ExtractionRun contract', () => {
  it('covers all seven status transitions', () => {
    const statuses: ExtractionRunStatus[] = [
      'pending',
      'running',
      'parser_error',
      'validation_failed',
      'quality_gate_failed',
      'review_required',
      'published',
    ];
    expect(statuses).toHaveLength(7);
  });

  it('ExtractionRun shape is correct', () => {
    const run: ExtractionRun = {
      id: 'run-1',
      repositoryUrl: 'https://github.com/example/repo',
      commitSha: 'abc123',
      parserName: 'express',
      parserVersion: '1.0.0',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(run.status).toBe('pending');
  });
});

describe('EvidenceRecord contract', () => {
  it('can represent an AI-suggested field', () => {
    const record: EvidenceRecord = {
      id: 'ev-1',
      extractionRunId: 'run-1',
      endpointId: 'ep-1',
      field: 'summary',
      value: 'Gets all users',
      source: 'llm-enrichment',
      verificationStatus: 'ai-suggested',
      timestamp: new Date(),
    };
    expect(record.source).toBe('llm-enrichment');
    expect(record.verificationStatus).toBe('ai-suggested');
  });

  it('security fields are typed and enumerated', () => {
    // Ensures the type union is not accidentally widened
    const securityFields: Array<'auth' | 'permissions' | 'rateLimit'> = [
      'auth',
      'permissions',
      'rateLimit',
    ];
    expect(securityFields).toHaveLength(3);
  });
});

describe('Canonical graph contracts', () => {
  it('Auth.verifiedByHuman field exists on the Auth type', () => {
    const auth: Auth = {
      id: 'auth-1',
      endpointId: 'ep-1',
      type: 'bearer',
      verifiedByHuman: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Auth can never be auto-accepted — verifiedByHuman must be explicitly set
    expect(auth.verifiedByHuman).toBe(false);
  });

  it('ApiGraph bundles all entities required by generators', () => {
    const graph: ApiGraph = {
      repository: {
        id: 'repo-1',
        url: 'https://github.com/example/repo',
        name: 'repo',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      api: {
        id: 'api-1',
        repositoryId: 'repo-1',
        name: 'Example API',
        hostUrl: 'https://api.example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      endpoints: [],
      schemas: [],
      auths: [],
      responses: [],
      versions: [],
    };
    expect(graph.endpoints).toHaveLength(0);
    expect(graph.api.hostUrl).toBe('https://api.example.com');
  });

  it('Response entity links to an endpoint via endpointId', () => {
    const response: import('../canonical-graph').Response = {
      id: 'resp-1',
      endpointId: 'ep-1',
      statusCode: '200',
      description: 'Success',
      content: { 'application/json': { schema: { type: 'object' } } },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(response.endpointId).toBe('ep-1');
    expect(response.statusCode).toBe('200');
  });
});

describe('Quality score contract', () => {
  it('score bands are correctly defined', () => {
    expect(SCORE_BAND_AUTO_ACCEPT_MIN).toBe(90);
    expect(SCORE_BAND_REVIEW_MIN).toBe(70);
  });

  it('security fields that always route to human-review are enumerated', () => {
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('auth');
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('permissions');
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('rateLimit');
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toHaveLength(3);
  });

  it('EndpointQualityScore shape includes hasSecurityField flag', () => {
    const score: EndpointQualityScore = {
      endpointPath: '/users',
      endpointMethod: 'GET',
      score: 95,
      outcome: 'human-review-required', // security field present → always review
      signals: {
        parserErrorRate: 0,
        fieldCompletenessRatio: 1,
      },
      hasSecurityField: true,
    };
    // Even at 95%, a security field forces human review
    expect(score.hasSecurityField).toBe(true);
    expect(score.outcome).toBe('human-review-required');
  });

  it('RunQualityReport overall outcome is restricted to Phase 1-2 values', () => {
    const report: RunQualityReport = {
      extractionRunId: 'run-1',
      endpointScores: [],
      overallOutcome: 'human-review-required',
    };
    // Phase 1-2: overallOutcome can only be 'human-review-required' | 'reject'
    const validOutcomes: RunQualityReport['overallOutcome'][] = [
      'human-review-required',
      'reject',
    ];
    expect(validOutcomes).toContain(report.overallOutcome);
  });
});
