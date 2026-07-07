// Canonical Graph: the sole source of truth.
// Domain hierarchy: Repository → API → Endpoint → Schema / Auth / Response / Version
//
// Human review edits these entities directly.
// Generated artifacts (OpenAPI, Markdown, SDKs) are derived views — never edited directly.

export interface Repository {
  id: string;
  url: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Api {
  id: string;
  repositoryId: string;
  name: string;
  description?: string;
  /** The URL of the running API host — used by host-prober for cross-source probing. */
  hostUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Endpoint {
  id: string;
  apiId: string;
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Schema {
  id: string;
  apiId: string;
  name: string;
  definition: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Auth.verifiedByHuman: auth fields can never be AI-verified — enforced in llm-enrichment
export interface Auth {
  id: string;
  endpointId: string;
  type: string;
  scheme?: string;
  scopes?: string[];
  verifiedByHuman: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A response defined for one endpoint. Linked by endpointId, not embedded in Endpoint,
 * so each (endpoint, statusCode) pair is a first-class entity that can be reviewed,
 * versioned, and diffed independently.
 *
 * content mirrors ParsedResponse.content: a map from media-type to inline schema data.
 * Stored as JSONB in Phase 2 Postgres; plain object in Phase 1 in-memory stores.
 */
export interface Response {
  id: string;
  endpointId: string;
  statusCode: string;
  description?: string;
  content?: Record<string, { schema?: unknown }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiVersion {
  id: string;
  apiId: string;
  extractionRunId: string;
  version: string;
  publishedAt?: Date;
  createdAt: Date;
}

// Full graph for one API — passed to generators as a pure value
export interface ApiGraph {
  repository: Repository;
  api: Api;
  endpoints: Endpoint[];
  schemas: Schema[];
  auths: Auth[];
  responses: Response[];
  versions: ApiVersion[];
}
