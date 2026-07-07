// llm-enrichment — Phase 0 stub
// Phase 2 implementation: THE ONLY MODULE allowed to call an LLM.
// Contract:
//   - Input: structured, redacted (raw repo files NEVER passed to LLM)
//   - Output: AI-tagged EvidenceRecord only (source: 'llm-enrichment', verificationStatus: 'ai-suggested')
//   - Security fields (auth, permissions, rateLimit) can NEVER be marked Verified from AI inference
//   - Prompt-injection resistance tested explicitly
// CI-enforced: only this module may import an LLM client.

import type { EvidenceRecord } from '@api-catalog/contracts';

export interface EnrichmentInput {
  endpointId: string;
  extractionRunId: string;
  /** Structured, pre-redacted context — never raw source files */
  structuredContext: Record<string, unknown>;
}

export interface EnrichmentOutput {
  evidence: Omit<EvidenceRecord, 'id' | 'timestamp'>[];
}

// Placeholder — full implementation in Phase 2
