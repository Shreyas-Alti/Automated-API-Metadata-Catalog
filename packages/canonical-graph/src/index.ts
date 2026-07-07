import type {
  Repository,
  Api,
  Endpoint,
  Schema,
  Auth,
  ApiVersion,
  ApiGraph,
  Response,
} from '@api-catalog/contracts';

export { buildGraph } from './build-graph';
export type { ApiGraph, Repository, Api, Endpoint, Schema, Auth, ApiVersion, Response };

/** Interface for persisting and querying the canonical domain model.
 *
 * Invariant: `saveGraph` and `upsert*` methods may ONLY be called with data
 * that originated from the parser pipeline (ExtractionResult → buildGraph).
 * `host-prober` probe results inform quality signals and cross-source agreement
 * counts but must NEVER create or modify Endpoint entities. Endpoints are
 * created exclusively by the extraction pipeline.
 */
export interface ICanonicalGraph {
  upsertRepository(repo: Omit<Repository, 'id' | 'createdAt' | 'updatedAt'>): Promise<Repository>;
  upsertApi(api: Omit<Api, 'id' | 'createdAt' | 'updatedAt'>): Promise<Api>;
  upsertEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint>;
  upsertSchema(schema: Omit<Schema, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schema>;
  upsertAuth(auth: Omit<Auth, 'id' | 'createdAt' | 'updatedAt'>): Promise<Auth>;
  getApiGraph(apiId: string): Promise<ApiGraph | null>;
  saveGraph(graph: ApiGraph): Promise<void>;
}
