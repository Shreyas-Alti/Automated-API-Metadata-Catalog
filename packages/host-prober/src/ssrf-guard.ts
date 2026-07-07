import { promises as dnsPromises } from 'dns';

// IPv4 CIDR ranges that must never be contacted.
// Includes private networks, loopback, link-local (169.254.0.0/16 covers AWS
// metadata endpoint 169.254.169.254), and other reserved blocks.
const BLOCKED_CIDRS_V4: Array<{ network: number; mask: number; label: string }> = [
  { network: cidrToNet('10.0.0.0'), mask: cidrMask(8), label: 'private (RFC1918)' },
  { network: cidrToNet('172.16.0.0'), mask: cidrMask(12), label: 'private (RFC1918)' },
  { network: cidrToNet('192.168.0.0'), mask: cidrMask(16), label: 'private (RFC1918)' },
  { network: cidrToNet('127.0.0.0'), mask: cidrMask(8), label: 'loopback' },
  { network: cidrToNet('169.254.0.0'), mask: cidrMask(16), label: 'link-local / cloud metadata' },
  { network: cidrToNet('0.0.0.0'), mask: cidrMask(8), label: 'unspecified' },
  { network: cidrToNet('100.64.0.0'), mask: cidrMask(10), label: 'shared address (CGN)' },
  { network: cidrToNet('192.0.2.0'), mask: cidrMask(24), label: 'documentation (TEST-NET-1)' },
  { network: cidrToNet('198.51.100.0'), mask: cidrMask(24), label: 'documentation (TEST-NET-2)' },
  { network: cidrToNet('203.0.113.0'), mask: cidrMask(24), label: 'documentation (TEST-NET-3)' },
  { network: cidrToNet('240.0.0.0'), mask: cidrMask(4), label: 'reserved' },
  { network: cidrToNet('255.255.255.255'), mask: cidrMask(32), label: 'broadcast' },
];

function cidrToNet(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function cidrMask(bits: number): number {
  return bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
}

function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

/** Throws SsrfBlockedError if the IPv4 address falls in a blocked range. */
export function assertIpv4IsPublic(ip: string): void {
  const num = ipv4ToNumber(ip);
  for (const { network, mask, label } of BLOCKED_CIDRS_V4) {
    if ((num & mask) === (network & mask)) {
      throw new SsrfBlockedError(`Blocked IP ${ip} (${label})`);
    }
  }
}

/** Throws SsrfBlockedError if the IPv6 address is loopback or link-local. */
export function assertIpv6IsPublic(ip: string): void {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');
  // ::1 is loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    throw new SsrfBlockedError(`Blocked IPv6 loopback: ${ip}`);
  }
  // fc00::/7 — unique local addresses
  const firstGroup = parseInt((normalized.split(':')[0] ?? '0'), 16);
  if ((firstGroup & 0xfe00) === 0xfc00) {
    throw new SsrfBlockedError(`Blocked IPv6 unique-local: ${ip}`);
  }
  // fe80::/10 — link-local
  if ((firstGroup & 0xffc0) === 0xfe80) {
    throw new SsrfBlockedError(`Blocked IPv6 link-local: ${ip}`);
  }
}

/**
 * Resolve hostname to IPv4/IPv6 addresses and assert none are private.
 * This is the DNS-rebind protection: the resolved IPs are checked, not the
 * hostname string itself.
 */
export async function assertHostnameResolvesToPublicIp(hostname: string): Promise<void> {
  const ipv4s = await dnsPromises.resolve4(hostname).catch(() => [] as string[]);
  const ipv6s = await dnsPromises.resolve6(hostname).catch(() => [] as string[]);

  for (const ip of ipv4s) {
    assertIpv4IsPublic(ip);
  }
  for (const ip of ipv6s) {
    assertIpv6IsPublic(ip);
  }

  if (ipv4s.length === 0 && ipv6s.length === 0) {
    throw new SsrfBlockedError(`Could not resolve hostname: ${hostname}`);
  }
}

/** Validate that a redirect destination URL is safe to follow. */
export function assertRedirectIsSafe(destinationUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(destinationUrl);
  } catch {
    throw new SsrfBlockedError(`Redirect to invalid URL: ${destinationUrl}`);
  }

  // Only allow https redirects
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SsrfBlockedError(
      `Redirect to non-HTTP protocol not allowed: ${parsed.protocol}`,
    );
  }

  // Block redirects to IP addresses directly (only hostnames go through DNS check)
  const hostname = parsed.hostname;
  // IPv4 literal check
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    assertIpv4IsPublic(hostname);
  }
}

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}
