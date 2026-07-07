// Canonical Graph: the sole source of truth.
// Domain hierarchy: Repository → API → Endpoint → Schema / Auth / Version
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
  versions: ApiVersion[];
}
