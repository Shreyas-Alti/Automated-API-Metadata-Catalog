import axios from 'axios';
import type { AxiosInstance } from 'axios';
import {
  assertHostnameResolvesToPublicIp,
  assertIpv4IsPublic,
  assertRedirectIsSafe,
} from './ssrf-guard';

export { SsrfBlockedError } from './ssrf-guard';
export {
  assertIpv4IsPublic,
  assertIpv6IsPublic,
  assertHostnameResolvesToPublicIp,
} from './ssrf-guard';

export interface ProbeOptions {
  /** Maximum response body size in bytes (default 1 MB). */
  maxResponseBytes?: number;
  /** Request timeout in ms (default 10 000). */
  timeoutMs?: number;
}

export interface ProbeResult {
  reachable: boolean;
  discoveredSpecUrl?: string;
  liveRouteSample?: string[];
  statusCode?: number;
  error?: string;
}

const SPEC_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
  '/swagger.yaml',
  '/.well-known/openapi',
  '/api-docs',
  '/api/docs',
  '/v1/openapi.json',
  '/v2/openapi.json',
  '/v3/openapi.json',
];

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_024 * 1_024; // 1 MB

/**
 * THE ONLY function allowed to make outbound HTTP requests to user-supplied URLs.
 * All SSRF protections are enforced here: private IP blocking, cloud metadata
 * blocking, DNS-rebind protection, redirect validation, timeout and size caps.
 *
 * Return value contract: probe results inform quality-gate signals (liveRouteCount,
 * crossSourceAgreement) and may surface a discoveredSpecUrl for human review.
 * They must NEVER be used to create or modify Endpoint entities in the canonical
 * graph — endpoints are created exclusively by the extraction pipeline.
 */
export async function probeHost(
  hostUrl: string,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_BYTES;

  let parsed: URL;
  try {
    parsed = new URL(hostUrl);
  } catch {
    return { reachable: false, error: `Invalid URL: ${hostUrl}` };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { reachable: false, error: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    try { assertIpv4IsPublic(hostname); }
    catch (e) { return { reachable: false, error: (e as Error).message }; }
  } else {
    try { await assertHostnameResolvesToPublicIp(hostname); }
    catch (e) { return { reachable: false, error: (e as Error).message }; }
  }

  const client: AxiosInstance = axios.create({
    timeout: timeoutMs,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    maxRedirects: 0,
    validateStatus: () => true,
  });

  const base = `${parsed.protocol}//${parsed.host}`;

  for (const specPath of SPEC_PATHS) {
    const url = `${base}${specPath}`;
    try {
      const response = await client.get<unknown>(url);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers['location'] as string | undefined;
        if (location) { try { assertRedirectIsSafe(location); } catch { continue; } }
        // Redirects are detected and safety-checked but never followed.
        // This is intentional: we fail closed. A future version can follow
        // safe redirects by re-entering the probe loop with the new URL.
        continue;
      }
      if (response.status === 200) {
        const ct = (response.headers['content-type'] as string | undefined) ?? '';
        if (ct.includes('json') || ct.includes('yaml') || specPath.endsWith('.json') || specPath.endsWith('.yaml')) {
          return { reachable: true, discoveredSpecUrl: url, statusCode: response.status };
        }
      }
    } catch { /* try next path */ }
  }

  try {
    const response = await client.get<unknown>(base);
    return { reachable: response.status < 500, statusCode: response.status };
  } catch {
    return { reachable: false, error: 'Host unreachable' };
  }
}

