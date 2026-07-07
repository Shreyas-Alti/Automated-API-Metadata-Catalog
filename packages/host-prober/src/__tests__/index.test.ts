import {
  assertIpv4IsPublic,
  assertIpv6IsPublic,
  assertHostnameResolvesToPublicIp,
  SsrfBlockedError,
} from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// SSRF security tests — all must pass before any Phase 1 PR merges.
// Each test verifies a specific protection layer.
// ─────────────────────────────────────────────────────────────────────────────

describe('assertIpv4IsPublic — private IP ranges are blocked', () => {
  const BLOCKED: string[] = [
    '10.0.0.1',          // RFC 1918 — 10/8
    '10.255.255.255',    // RFC 1918 — 10/8 broadcast
    '172.16.0.1',        // RFC 1918 — 172.16/12
    '172.31.255.254',    // RFC 1918 — 172.31/12 boundary
    '192.168.0.1',       // RFC 1918 — 192.168/16
    '192.168.255.255',   // RFC 1918 — 192.168/16 broadcast
    '127.0.0.1',         // loopback
    '127.255.255.255',   // loopback range
    '169.254.0.1',       // link-local (covers AWS metadata)
    '169.254.169.254',   // AWS EC2 instance metadata endpoint
    '0.0.0.0',           // unspecified
    '100.64.0.1',        // shared CGN space (RFC 6598)
  ];

  for (const ip of BLOCKED) {
    it(`blocks ${ip}`, () => {
      expect(() => assertIpv4IsPublic(ip)).toThrow(SsrfBlockedError);
    });
  }

  it('allows a public IP', () => {
    expect(() => assertIpv4IsPublic('8.8.8.8')).not.toThrow();
    expect(() => assertIpv4IsPublic('1.1.1.1')).not.toThrow();
    expect(() => assertIpv4IsPublic('93.184.216.34')).not.toThrow();
  });
});

describe('assertIpv6IsPublic — loopback and link-local are blocked', () => {
  it('blocks ::1 (IPv6 loopback)', () => {
    expect(() => assertIpv6IsPublic('::1')).toThrow(SsrfBlockedError);
  });

  it('blocks fc00:: (unique-local)', () => {
    expect(() => assertIpv6IsPublic('fc00::1')).toThrow(SsrfBlockedError);
  });

  it('blocks fd00:: (unique-local)', () => {
    expect(() => assertIpv6IsPublic('fd00::1')).toThrow(SsrfBlockedError);
  });

  it('blocks fe80:: (link-local)', () => {
    expect(() => assertIpv6IsPublic('fe80::1')).toThrow(SsrfBlockedError);
  });

  it('allows a public IPv6 address', () => {
    expect(() => assertIpv6IsPublic('2606:4700:4700::1111')).not.toThrow();
  });
});

describe('assertHostnameResolvesToPublicIp — DNS-rebind-to-private protection', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { promises: dnsPromises } = require('dns') as typeof import('dns');

  afterEach(() => jest.restoreAllMocks());

  it('throws SsrfBlockedError when hostname resolves to a private IPv4', async () => {
    jest.spyOn(dnsPromises, 'resolve4').mockResolvedValue(['10.0.0.1']);
    jest.spyOn(dnsPromises, 'resolve6').mockRejectedValue(new Error('ENODATA'));
    await expect(assertHostnameResolvesToPublicIp('evil.internal')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError when hostname resolves to AWS metadata IP', async () => {
    jest.spyOn(dnsPromises, 'resolve4').mockResolvedValue(['169.254.169.254']);
    jest.spyOn(dnsPromises, 'resolve6').mockRejectedValue(new Error('ENODATA'));
    await expect(assertHostnameResolvesToPublicIp('metadata.internal')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError when hostname resolves to loopback', async () => {
    jest.spyOn(dnsPromises, 'resolve4').mockResolvedValue(['127.0.0.1']);
    jest.spyOn(dnsPromises, 'resolve6').mockRejectedValue(new Error('ENODATA'));
    await expect(assertHostnameResolvesToPublicIp('localhost')).rejects.toThrow(SsrfBlockedError);
  });

  it('resolves successfully for a hostname with public IPs', async () => {
    jest.spyOn(dnsPromises, 'resolve4').mockResolvedValue(['8.8.8.8']);
    jest.spyOn(dnsPromises, 'resolve6').mockRejectedValue(new Error('ENODATA'));
    await expect(assertHostnameResolvesToPublicIp('google.com')).resolves.toBeUndefined();
  });
});

describe('probeHost — integration-level SSRF rejection tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { probeHost } = require('../index') as typeof import('../index');

  it('rejects a direct private IPv4 URL without making a network request', async () => {
    const result = await probeHost('http://10.0.0.1/api');
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/[Bb]locked/);
  });

  it('rejects the AWS metadata endpoint URL', async () => {
    const result = await probeHost('http://169.254.169.254/latest/meta-data/');
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/[Bb]locked|metadata/i);
  });

  it('rejects a 192.168.x.x URL', async () => {
    const result = await probeHost('http://192.168.1.1/admin');
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/[Bb]locked/);
  });

  it('rejects an unsupported protocol', async () => {
    const result = await probeHost('ftp://example.com/api');
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/[Uu]nsupported protocol/);
  });

  it('rejects a malformed URL', async () => {
    const result = await probeHost('not-a-url');
    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/[Ii]nvalid URL/);
  });
});

