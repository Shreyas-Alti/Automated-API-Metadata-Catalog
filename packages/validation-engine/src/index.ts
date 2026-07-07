// validation-engine — Phase 0 stub
// Phase 1 implementation: mechanical checks only — no AI, no DB, no outbound HTTP.
// Rules (one test per rule, pass + fail fixture each):
//   - duplicate routes
//   - orphan schemas ($ref targets that don't exist)
//   - missing request bodies on POST/PUT/PATCH routes
//   - invalid $ref pointers
// CI-enforced: zero dependency on any LLM client, DB client, or HTTP client library.

import type { ExtractionResult, ValidationSummary } from '@api-catalog/contracts';

export interface ValidationRule {
  name: string;
  check(result: ExtractionResult): ValidationSummary;
}

// Placeholder — full rule implementations in Phase 1
