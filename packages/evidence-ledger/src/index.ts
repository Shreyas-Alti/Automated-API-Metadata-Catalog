import { randomUUID } from 'crypto';
import type {
  EvidenceRecord,
  EndpointEvidenceSummary,
  EvidenceSource,
  VerificationStatus,
} from '@api-catalog/contracts';

/** Append-only interface — no update or delete methods exist by design. */
export interface IEvidenceLedger {
  append(record: Omit<EvidenceRecord, 'id' | 'timestamp'>): Promise<EvidenceRecord>;
  getSummary(endpointId: string): Promise<EndpointEvidenceSummary | null>;
  getRecords(endpointId: string): Promise<EvidenceRecord[]>;
}

export type { EvidenceRecord, EndpointEvidenceSummary };

/** In-memory implementation — no database required for Phase 1 CLI. */
export class InMemoryEvidenceLedger implements IEvidenceLedger {
  private readonly _records: EvidenceRecord[] = [];

  async append(record: Omit<EvidenceRecord, 'id' | 'timestamp'>): Promise<EvidenceRecord> {
    const full: EvidenceRecord = {
      ...record,
      id: randomUUID(),
      timestamp: new Date(),
    };
    this._records.push(full);
    return full;
  }

  async getSummary(endpointId: string): Promise<EndpointEvidenceSummary | null> {
    const records = this._records.filter((r) => r.endpointId === endpointId);
    if (records.length === 0) return null;

    const fieldSources: Record<string, EvidenceSource> = {};
    const fieldVerificationStatus: Record<string, VerificationStatus> = {};
    let hasSecurityFields = false;

    const securityFieldNames = new Set(['auth', 'permissions', 'rateLimit']);

    for (const rec of records) {
      fieldSources[rec.field] = rec.source;
      fieldVerificationStatus[rec.field] = rec.verificationStatus;
      if (securityFieldNames.has(rec.field)) hasSecurityFields = true;
    }

    const lastUpdated = records.reduce(
      (max, r) => (r.timestamp > max ? r.timestamp : max),
      records[0]!.timestamp,
    );

    return { endpointId, lastUpdated, fieldSources, fieldVerificationStatus, hasSecurityFields };
  }

  async getRecords(endpointId: string): Promise<EvidenceRecord[]> {
    return this._records.filter((r) => r.endpointId === endpointId);
  }

  /** For testing only — total record count. */
  get size(): number { return this._records.length; }
}

