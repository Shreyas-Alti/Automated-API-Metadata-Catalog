// EvidenceRecord: append-only. No update/delete methods exist at the interface level.
// Every claim about an endpoint field is backed by an EvidenceRecord.

export type EvidenceSource =
  | 'parser'
  | 'host-prober'
  | 'llm-enrichment'
  | 'human-review';

// AI inference can only produce 'ai-suggested'. Only 'human-review' source
// can produce 'verified' status for security fields.
export type VerificationStatus = 'verified' | 'ai-suggested' | 'unverified';

// Security fields: auth, permissions, rateLimit.
// These can NEVER be marked 'verified' from AI inference.
// They can NEVER be auto-accepted regardless of quality score.
export type SecurityFieldName = 'auth' | 'permissions' | 'rateLimit';

export interface EvidenceRecord {
  id: string;
  extractionRunId: string;
  endpointId: string;
  // The field this record pertains to (e.g. 'summary', 'auth', 'rateLimit')
  field: string;
  value: unknown;
  source: EvidenceSource;
  verificationStatus: VerificationStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Denormalized per-endpoint summary recomputed on each EvidenceRecord append
export interface EndpointEvidenceSummary {
  endpointId: string;
  lastUpdated: Date;
  fieldSources: Record<string, EvidenceSource>;
  fieldVerificationStatus: Record<string, VerificationStatus>;
  hasSecurityFields: boolean;
}
