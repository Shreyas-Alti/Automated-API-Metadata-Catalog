import { buildGraph } from '../index';
import type { ExtractionResult, EndpointEvidenceSummary } from '@api-catalog/contracts';

function makeResult(routes: ExtractionResult['routes'] = []): ExtractionResult {
  return { parserName: 'express', parserVersion: '1.0.0', capabilities: { routes: 'supported', models: 'not supported', middleware: 'not supported', auth: 'not supported', rateLimits: 'not supported' }, routes, schemas: {}, errors: [], warnings: [] };
}

describe('buildGraph', () => {
  const emptyEvidence = new Map<string, EndpointEvidenceSummary>();

  it('creates a Repository with the correct URL', () => {
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', makeResult(), emptyEvidence, 'run-1');
    expect(graph.repository.url).toBe('https://github.com/org/repo');
  });

  it('creates one Endpoint per route', () => {
    const result = makeResult([
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users' },
    ]);
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', result, emptyEvidence, 'run-1');
    expect(graph.endpoints).toHaveLength(2);
    expect(graph.endpoints[0]).toMatchObject({ method: 'GET', path: '/users' });
    expect(graph.endpoints[1]).toMatchObject({ method: 'POST', path: '/users' });
  });

  it('all endpoints belong to the API', () => {
    const result = makeResult([{ method: 'GET', path: '/x' }]);
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', result, emptyEvidence, 'run-1');
    expect(graph.endpoints[0]?.apiId).toBe(graph.api.id);
  });

  it('creates an Auth entity for routes with security', () => {
    const result = makeResult([
      { method: 'GET', path: '/secure', security: [{ type: 'bearer', scheme: 'JWT' }] },
    ]);
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', result, emptyEvidence, 'run-1');
    expect(graph.auths).toHaveLength(1);
    expect(graph.auths[0]?.type).toBe('bearer');
    expect(graph.auths[0]?.verifiedByHuman).toBe(false);
  });

  it('creates one ApiVersion with the run ID', () => {
    const result = makeResult([{ method: 'GET', path: '/x' }]);
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', result, emptyEvidence, 'run-42');
    expect(graph.versions).toHaveLength(1);
    expect(graph.versions[0]?.extractionRunId).toBe('run-42');
  });

  it('returns an empty graph for a result with no routes', () => {
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', makeResult(), emptyEvidence, 'run-1');
    expect(graph.endpoints).toHaveLength(0);
    expect(graph.auths).toHaveLength(0);
  });
});
