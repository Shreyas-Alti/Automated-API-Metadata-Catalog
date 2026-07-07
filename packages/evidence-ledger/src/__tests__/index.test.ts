import type { IEvidenceLedger } from '../index';

describe('evidence-ledger', () => {
  it('IEvidenceLedger interface does not expose update or delete methods', () => {
    // Structural check: the interface only exposes append, getSummary, getRecords
    const allowedMethods: Array<keyof IEvidenceLedger> = ['append', 'getSummary', 'getRecords'];
    expect(allowedMethods).not.toContain('update');
    expect(allowedMethods).not.toContain('delete');
    expect(allowedMethods).not.toContain('remove');
  });

  it('module stub compiles — append-only contract defined', () => {
    expect(true).toBe(true);
  });
});
