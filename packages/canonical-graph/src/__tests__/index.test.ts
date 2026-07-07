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
    expect(graph.responses).toHaveLength(0);
  });

  it('populates Response entities from ParsedRoute.responses (data is not dropped)', () => {
    const result = makeResult([{
      method: 'GET', path: '/users',
      responses: [
        { statusCode: '200', description: 'List of users', content: { 'application/json': { schema: { type: 'array' } } } },
        { statusCode: '404', description: 'Not found' },
      ],
    }]);
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', result, emptyEvidence, 'run-1');
    expect(graph.responses).toHaveLength(2);
    expect(graph.responses[0]?.statusCode).toBe('200');
    expect(graph.responses[1]?.statusCode).toBe('404');
    expect(graph.responses[0]?.endpointId).toBe(graph.endpoints[0]?.id);
  });

  it('passes hostUrl through to the Api entity', () => {
    const graph = buildGraph('https://github.com/org/repo', 'MyAPI', makeResult(), emptyEvidence, 'run-1', 'https://api.example.com');
    expect(graph.api.hostUrl).toBe('https://api.example.com');
  });
});
