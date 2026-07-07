import type { HostProbeTarget } from '../index';

describe('host-prober', () => {
  it('ProbeTarget type is importable', () => {
    const target: HostProbeTarget = { hostUrl: 'https://example.com', timeoutMs: 5000 };
    expect(target.hostUrl).toBe('https://example.com');
  });

  it('module stub compiles — SSRF hardening implementation deferred to Phase 1', () => {
    expect(true).toBe(true);
  });
});
