import type {
  ExtractionResult,
  ValidationSummary,
  ValidationError,
  ValidationWarning,
} from '@api-catalog/contracts';

// ─── Rule 1: Duplicate routes ────────────────────────────────────────────────

function checkDuplicateRoutes(result: ExtractionResult): ValidationError[] {
  const seen = new Map<string, number>();
  const errors: ValidationError[] = [];

  for (const route of result.routes) {
    const key = `${route.method.toUpperCase()}:${route.path}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) {
      errors.push({
        kind: 'duplicate_route',
        message: `Duplicate route: ${key}`,
        location: route.sourceLocation?.file,
      });
    }
  }
  return errors;
}

// ─── Rule 2: Orphan schemas ($ref targets that don't exist) ──────────────────

function collectRefs(schema: unknown, refs: Set<string>): void {
  if (typeof schema !== 'object' || schema === null) return;
  const obj = schema as Record<string, unknown>;
  if (typeof obj['$ref'] === 'string') refs.add(obj['$ref']);
  for (const value of Object.values(obj)) collectRefs(value, refs);
}

function checkOrphanSchemas(result: ExtractionResult): ValidationError[] {
  const refs = new Set<string>();

  for (const route of result.routes) {
    for (const param of route.parameters ?? []) collectRefs(param.schema, refs);
    collectRefs(route.requestBody, refs);
    for (const resp of route.responses ?? []) collectRefs(resp, refs);
  }
  for (const schema of Object.values(result.schemas)) collectRefs(schema, refs);

  const errors: ValidationError[] = [];
  for (const ref of refs) {
    // Only check local schema refs of the form #/components/schemas/<Name>
    const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
    if (match) {
      const schemaName = match[1]!;
      if (!(schemaName in result.schemas)) {
        errors.push({
          kind: 'orphan_schema',
          message: `$ref target not found: ${ref}`,
        });
      }
    }
  }
  return errors;
}

// ─── Rule 3: Missing request bodies on POST / PUT / PATCH ────────────────────

function checkMissingBodies(result: ExtractionResult): ValidationWarning[] {
  const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
  return result.routes
    .filter(
      (r) =>
        BODY_METHODS.has(r.method.toUpperCase()) &&
        (r.requestBody === undefined || r.requestBody === null),
    )
    .map((r) => ({
      kind: 'missing_request_body',
      message: `${r.method.toUpperCase()} ${r.path} has no requestBody defined`,
      location: r.sourceLocation?.file,
    }));
}

// ─── Rule 4: Invalid $ref format ─────────────────────────────────────────────

const VALID_REF_RE = /^(#\/|https?:\/\/|\.\/).*/;

function checkInvalidRefs(result: ExtractionResult): ValidationError[] {
  const refs = new Set<string>();
  for (const route of result.routes) {
    for (const p of route.parameters ?? []) collectRefs(p.schema, refs);
    collectRefs(route.requestBody, refs);
    for (const r of route.responses ?? []) collectRefs(r, refs);
  }
  for (const schema of Object.values(result.schemas)) collectRefs(schema, refs);

  return Array.from(refs)
    .filter((ref) => !VALID_REF_RE.test(ref))
    .map((ref) => ({
      kind: 'invalid_ref',
      message: `Invalid $ref format: "${ref}" — must start with #/, http://, https://, or ./`,
    }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Run all mechanical validation rules against an ExtractionResult.
 *  CI-enforced: this module has zero dependency on any LLM client. */
export function validate(result: ExtractionResult): ValidationSummary {
  const errors: ValidationError[] = [
    ...checkDuplicateRoutes(result),
    ...checkOrphanSchemas(result),
    ...checkInvalidRefs(result),
  ];
  const warnings: ValidationWarning[] = [
    ...checkMissingBodies(result),
  ];

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export { checkDuplicateRoutes, checkOrphanSchemas, checkMissingBodies, checkInvalidRefs };

