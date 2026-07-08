import { randomUUID } from 'crypto';
import type { PrismaClient } from '@api-catalog/database';
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

// ─── In-memory implementation (Phase 1 CLI + tests) ──────────────────────────

export class InMemoryEvidenceLedger implements IEvidenceLedger {
  private readonly _records: EvidenceRecord[] = [];

  async append(record: Omit<EvidenceRecord, 'id' | 'timestamp'>): Promise<EvidenceRecord> {
    const full: EvidenceRecord = { ...record, id: randomUUID(), timestamp: new Date() };
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

  get size(): number { return this._records.length; }
}

// ─── Prisma implementation (Phase 2 API service) ─────────────────────────────

export class PrismaEvidenceLedger implements IEvidenceLedger {
  constructor(private readonly prisma: PrismaClient) {}

  async append(record: Omit<EvidenceRecord, 'id' | 'timestamp'>): Promise<EvidenceRecord> {
    const row = await this.prisma.evidenceRecord.create({
      data: {
        extractionRunId: record.extractionRunId,
        endpointId: record.endpointId,
        field: record.field,
        value: record.value as Parameters<typeof this.prisma.evidenceRecord.create>[0]['data']['value'],
        source: record.source,
        verificationStatus: record.verificationStatus,
        metadata: record.metadata as Parameters<typeof this.prisma.evidenceRecord.create>[0]['data']['metadata'],
      },
    });
    return {
      id: row.id,
      extractionRunId: row.extractionRunId,
      endpointId: row.endpointId,
      field: row.field,
      value: row.value,
      source: row.source as EvidenceSource,
      verificationStatus: row.verificationStatus as VerificationStatus,
      timestamp: row.timestamp,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }

  async getSummary(endpointId: string): Promise<EndpointEvidenceSummary | null> {
    const records = await this.getRecords(endpointId);
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
    const rows = await this.prisma.evidenceRecord.findMany({ where: { endpointId } });
    return rows.map((row) => ({
      id: row.id,
      extractionRunId: row.extractionRunId,
      endpointId: row.endpointId,
      field: row.field,
      value: row.value,
      source: row.source as EvidenceSource,
      verificationStatus: row.verificationStatus as VerificationStatus,
      timestamp: row.timestamp,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }));
  }
}


