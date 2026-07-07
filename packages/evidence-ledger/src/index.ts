// evidence-ledger — Phase 0 stub
// Phase 1 implementation: append-only EvidenceRecord store.
// Interface contract: NO update or delete methods exist — append only.
// Denormalized per-endpoint summary is recomputed on each append.
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.

import type {
  EvidenceRecord,
  EndpointEvidenceSummary,
} from '@api-catalog/contracts';

/** Append-only interface — no update/delete methods. Immutability enforced here. */
export interface IEvidenceLedger {
  append(record: Omit<EvidenceRecord, 'id' | 'timestamp'>): Promise<EvidenceRecord>;
  getSummary(endpointId: string): Promise<EndpointEvidenceSummary | null>;
  getRecords(endpointId: string): Promise<EvidenceRecord[]>;
  // NOTE: no update(), no delete() — intentional
}

export type { EvidenceRecord, EndpointEvidenceSummary };
