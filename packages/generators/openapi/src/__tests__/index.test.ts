import { generateOpenApi } from '../index';
import type { ApiGraph } from '@api-catalog/contracts';

function makeGraph(overrides: Partial<ApiGraph> = {}): ApiGraph {
  const now = new Date();
  return {
    repository: { id: 'repo-1', url: 'https://github.com/x/y', name: 'test', createdAt: now, updatedAt: now },
    api: { id: 'api-1', repositoryId: 'repo-1', name: 'Test API', createdAt: now, updatedAt: now },
    endpoints: [],
    schemas: [],
    auths: [],
    responses: [],
    versions: [{ id: 'v-1', apiId: 'api-1', extractionRunId: 'run-1', version: 'express-1.0.0', createdAt: now }],
    ...overrides,
  };
}

describe('generateOpenApi', () => {
  it('produces a valid OpenAPI 3.1.0 document', () => {
    const doc = generateOpenApi(makeGraph());
    expect(doc.openapi).toBe('3.1.0');
  });

  it('sets info.title from the API name', () => {
    const doc = generateOpenApi(makeGraph());
    expect(doc.info.title).toBe('Test API');
  });

  it('creates a path entry for each endpoint', () => {
    const now = new Date();
    const doc = generateOpenApi(makeGraph({
      endpoints: [
        { id: 'ep-1', apiId: 'api-1', method: 'GET', path: '/users', createdAt: now, updatedAt: now },
        { id: 'ep-2', apiId: 'api-1', method: 'POST', path: '/users', createdAt: now, updatedAt: now },
      ],
    }));
    expect(doc.paths['/users']).toBeDefined();
    expect(doc.paths['/users']?.['get']).toBeDefined();
    expect(doc.paths['/users']?.['post']).toBeDefined();
  });

  it('snapshot — output matches expected shape', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const graph = makeGraph({
      endpoints: [
        { id: 'ep-1', apiId: 'api-1', method: 'GET', path: '/health', operationId: 'getHealth', createdAt: now, updatedAt: now },
      ],
    });
    const doc = generateOpenApi(graph);
    expect(doc).toMatchSnapshot();
  });

  it('empty graph produces empty paths', () => {
    const doc = generateOpenApi(makeGraph());
    expect(Object.keys(doc.paths)).toHaveLength(0);
  });
});
