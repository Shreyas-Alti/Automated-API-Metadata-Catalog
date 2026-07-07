// Parser output: every field a parser can extract from source code
export interface ParsedRoute {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses?: ParsedResponse[];
  tags?: string[];
  security?: ParsedSecurity[];
  rateLimit?: ParsedRateLimit;
  sourceLocation?: SourceLocation;
}

export interface ParsedParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: ParsedSchema;
}

export interface ParsedRequestBody {
  required?: boolean;
  content?: Record<string, { schema?: ParsedSchema }>;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
  content?: Record<string, { schema?: ParsedSchema }>;
}

export interface ParsedSchema {
  type?: string;
  $ref?: string;
  properties?: Record<string, ParsedSchema>;
  items?: ParsedSchema;
  enum?: unknown[];
  required?: string[];
  nullable?: boolean;
  description?: string;
}

export interface ParsedSecurity {
  type: string;
  scheme?: string;
  scopes?: string[];
}

// Rate limit source must be explicit — never inferred from nothing
export interface ParsedRateLimit {
  requestsPerWindow?: number;
  windowSeconds?: number;
  source: 'middleware' | 'decorator' | 'inferred';
}

export interface SourceLocation {
  file: string;
  line?: number;
}

// Each parser declares its own capabilities — never hand-maintained in a central table
export interface ParserCapabilities {
  routes: 'supported' | 'partial' | 'not supported';
  models: 'supported' | 'partial' | 'not supported';
  middleware: 'supported' | 'partial' | 'not supported';
  auth: 'supported' | 'partial' | 'not supported';
  rateLimits: 'supported' | 'partial' | 'not supported';
}

export interface ExtractionError {
  file: string;
  message: string;
  kind: 'parse_error' | 'unhandled_construct' | 'timeout';
}

export interface ExtractionWarning {
  file: string;
  message: string;
}

// The immutable output of one parser run against one repo at one commit
export interface ExtractionResult {
  parserName: string;
  parserVersion: string;
  capabilities: ParserCapabilities;
  routes: ParsedRoute[];
  schemas: Record<string, ParsedSchema>;
  errors: ExtractionError[];
  warnings: ExtractionWarning[];
}
