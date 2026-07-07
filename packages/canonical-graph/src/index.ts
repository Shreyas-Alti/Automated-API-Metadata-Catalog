// canonical-graph — Phase 0 stub
// Phase 1 implementation: domain model + buildGraph(extractionResult, evidence).
// THE SOLE SOURCE OF TRUTH. Human review edits these entities directly.
// Generated artifacts (OpenAPI, Markdown) are derived views — never edited directly.
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.

import type {
  Repository,
  Api,
  Endpoint,
  Schema,
  Auth,
  ApiVersion,
  ApiGraph,
} from '@api-catalog/contracts';

export interface ICanonicalGraph {
  upsertRepository(repo: Omit<Repository, 'id' | 'createdAt' | 'updatedAt'>): Promise<Repository>;
  upsertApi(api: Omit<Api, 'id' | 'createdAt' | 'updatedAt'>): Promise<Api>;
  upsertEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint>;
  upsertSchema(schema: Omit<Schema, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schema>;
  upsertAuth(auth: Omit<Auth, 'id' | 'createdAt' | 'updatedAt'>): Promise<Auth>;
  getApiGraph(apiId: string): Promise<ApiGraph | null>;
}

export type {
  Repository,
  Api,
  Endpoint,
  Schema,
  Auth,
  ApiVersion,
  ApiGraph,
};
