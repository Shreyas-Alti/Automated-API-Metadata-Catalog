import { InMemoryEvidenceLedger } from '../index';

describe('InMemoryEvidenceLedger', () => {
  let ledger: InMemoryEvidenceLedger;

  beforeEach(() => { ledger = new InMemoryEvidenceLedger(); });

  it('append returns a record with an id and timestamp', async () => {
    const rec = await ledger.append({ extractionRunId: 'run-1', endpointId: 'ep-1', field: 'summary', value: 'hello', source: 'parser', verificationStatus: 'unverified' });
    expect(rec.id).toBeTruthy();
    expect(rec.timestamp).toBeInstanceOf(Date);
  });

  it('append is truly append-only — no update or delete method exists', () => {
    const keys = Object.keys(Object.getPrototypeOf(ledger) as object) as string[];
    expect(keys).not.toContain('update');
    expect(keys).not.toContain('delete');
    expect(keys).not.toContain('remove');
  });

  it('getRecords returns all records for an endpoint', async () => {
    await ledger.append({ extractionRunId: 'r', endpointId: 'ep-1', field: 'summary', value: 'v', source: 'parser', verificationStatus: 'unverified' });
    await ledger.append({ extractionRunId: 'r', endpointId: 'ep-1', field: 'description', value: 'd', source: 'llm-enrichment', verificationStatus: 'ai-suggested' });
    await ledger.append({ extractionRunId: 'r', endpointId: 'ep-2', field: 'summary', value: 'x', source: 'parser', verificationStatus: 'unverified' });
    expect(await ledger.getRecords('ep-1')).toHaveLength(2);
    expect(await ledger.getRecords('ep-2')).toHaveLength(1);
  });

  it('getSummary returns null for an endpoint with no records', async () => {
    expect(await ledger.getSummary('ep-unknown')).toBeNull();
  });

  it('getSummary computes field sources and verification status', async () => {
    await ledger.append({ extractionRunId: 'r', endpointId: 'ep-1', field: 'summary', value: 'v', source: 'parser', verificationStatus: 'unverified' });
    const summary = await ledger.getSummary('ep-1');
    expect(summary?.fieldSources['summary']).toBe('parser');
    expect(summary?.fieldVerificationStatus['summary']).toBe('unverified');
  });

  it('getSummary marks hasSecurityFields=true when auth field is appended', async () => {
    await ledger.append({ extractionRunId: 'r', endpointId: 'ep-1', field: 'auth', value: 'bearer', source: 'parser', verificationStatus: 'unverified' });
    const summary = await ledger.getSummary('ep-1');
    expect(summary?.hasSecurityFields).toBe(true);
  });
});
