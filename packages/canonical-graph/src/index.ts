import type {
  Repository,
  Api,
  Endpoint,
  Schema,
  Auth,
  ApiVersion,
  ApiGraph,
} from '@api-catalog/contracts';

export { buildGraph } from './build-graph';
export type { ApiGraph, Repository, Api, Endpoint, Schema, Auth, ApiVersion };

/** Interface for persisting and querying the canonical domain model. */
export interface ICanonicalGraph {
  upsertRepository(repo: Omit<Repository, 'id' | 'createdAt' | 'updatedAt'>): Promise<Repository>;
  upsertApi(api: Omit<Api, 'id' | 'createdAt' | 'updatedAt'>): Promise<Api>;
  upsertEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint>;
  upsertSchema(schema: Omit<Schema, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schema>;
  upsertAuth(auth: Omit<Auth, 'id' | 'createdAt' | 'updatedAt'>): Promise<Auth>;
  getApiGraph(apiId: string): Promise<ApiGraph | null>;
  saveGraph(graph: ApiGraph): Promise<void>;
}
