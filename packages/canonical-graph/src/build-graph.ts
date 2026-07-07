import { randomUUID } from 'crypto';
import type {
  ExtractionResult,
  EndpointEvidenceSummary,
  ApiGraph,
  Repository,
  Api,
  Endpoint,
  Auth,
  ApiVersion,
} from '@api-catalog/contracts';

/**
 * Build a canonical ApiGraph from an ExtractionResult and evidence summaries.
 * This is a pure transformation — no database access, no side effects.
 *
 * @param repoUrl   - The repository URL (used as the Repository identifier)
 * @param apiName   - Human-readable API name
 * @param result    - The parser's ExtractionResult
 * @param evidence  - Per-endpoint evidence summaries from the evidence ledger
 * @param runId     - The ExtractionRun ID for version tracking
 */
export function buildGraph(
  repoUrl: string,
  apiName: string,
  result: ExtractionResult,
  evidence: Map<string, EndpointEvidenceSummary>,
  runId: string,
): ApiGraph {
  const now = new Date();

  const repository: Repository = {
    id: randomUUID(),
    url: repoUrl,
    name: apiName,
    createdAt: now,
    updatedAt: now,
  };

  const api: Api = {
    id: randomUUID(),
    repositoryId: repository.id,
    name: apiName,
    createdAt: now,
    updatedAt: now,
  };

  const endpoints: Endpoint[] = result.routes.map((route) => ({
    id: randomUUID(),
    apiId: api.id,
    method: route.method,
    path: route.path,
    tags: route.tags,
    createdAt: now,
    updatedAt: now,
  }));

  // Build Auth entities from evidence (only if human-verified)
  const auths: Auth[] = [];
  for (let i = 0; i < result.routes.length; i++) {
    const route = result.routes[i]!;
    const ep = endpoints[i]!;
    const epEvidence = evidence.get(ep.id);

    if (route.security && route.security.length > 0) {
      for (const sec of route.security) {
        auths.push({
          id: randomUUID(),
          endpointId: ep.id,
          type: sec.type,
          scheme: sec.scheme,
          scopes: sec.scopes,
          // auth.verifiedByHuman is false unless a human has explicitly verified it
          verifiedByHuman: epEvidence?.fieldVerificationStatus['auth'] === 'verified',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  const version: ApiVersion = {
    id: randomUUID(),
    apiId: api.id,
    extractionRunId: runId,
    version: `${result.parserName}-${result.parserVersion}`,
    createdAt: now,
  };

  return {
    repository,
    api,
    endpoints,
    schemas: [],
    auths,
    versions: [version],
  };
}
