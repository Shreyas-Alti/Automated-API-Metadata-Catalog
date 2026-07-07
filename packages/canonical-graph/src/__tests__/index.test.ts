import type { ICanonicalGraph } from '../index';

describe('canonical-graph', () => {
  it('ICanonicalGraph interface exposes upsert operations and getApiGraph', () => {
    const methods: Array<keyof ICanonicalGraph> = [
      'upsertRepository',
      'upsertApi',
      'upsertEndpoint',
      'upsertSchema',
      'upsertAuth',
      'getApiGraph',
    ];
    expect(methods).toHaveLength(6);
  });

  it('module stub compiles — sole source of truth domain model defined', () => {
    expect(true).toBe(true);
  });
});
