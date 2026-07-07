import type { ApiGraph } from '@api-catalog/contracts';

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  paths: Record<string, OpenApiPathItem>;
  components?: { schemas?: Record<string, OpenApiSchema> };
}

interface OpenApiPathItem {
  [method: string]: OpenApiOperation;
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: { required?: boolean; content: Record<string, { schema?: OpenApiSchema }> };
  responses: Record<string, { description: string; content?: Record<string, { schema?: OpenApiSchema }> }>;
  security?: Array<Record<string, string[]>>;
}

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenApiSchema;
}

interface OpenApiSchema {
  type?: string;
  $ref?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  description?: string;
}

/**
 * Pure function: ApiGraph → OpenAPI 3.1 document.
 * Generated artifacts are NEVER edited directly by humans — they are always
 * regenerable from the canonical graph.
 */

function buildResponses(
  graph: ApiGraph,
  endpointId: string,
): Record<string, { description: string; content?: Record<string, { schema?: OpenApiSchema }> }> {
  const endpointResponses = graph.responses.filter((r) => r.endpointId === endpointId);

  if (endpointResponses.length === 0) {
    return {
      '200': { description: 'Success' },
      default: { description: 'Unexpected error' },
    };
  }

  const result: Record<string, { description: string; content?: Record<string, { schema?: OpenApiSchema }> }> = {};
  for (const resp of endpointResponses) {
    result[resp.statusCode] = {
      description: resp.description ?? 'Response',
      content: resp.content as Record<string, { schema?: OpenApiSchema }> | undefined,
    };
  }
  return result;
}
export function generateOpenApi(graph: ApiGraph): OpenApiDocument {
  const paths: Record<string, OpenApiPathItem> = {};

  for (const endpoint of graph.endpoints) {
    const method = endpoint.method.toLowerCase();
    const path = endpoint.path;

    if (!paths[path]) paths[path] = {};

    const operation: OpenApiOperation = {
      operationId: endpoint.operationId ?? `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      responses: buildResponses(graph, endpoint.id),
    };

    // Attach security info from auth entities
    const endpointAuths = graph.auths.filter((a) => a.endpointId === endpoint.id);
    if (endpointAuths.length > 0) {
      operation.security = endpointAuths.map((a) => ({
        [a.type]: a.scopes ?? [],
      }));
    }

    paths[path]![method] = operation;
  }

  const doc: OpenApiDocument = {
    openapi: '3.1.0',
    info: {
      title: graph.api.name,
      version: graph.versions[0]?.version ?? '0.0.0',
      description: graph.api.description,
    },
    paths,
  };

  return doc;
}

