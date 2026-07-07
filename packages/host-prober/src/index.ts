// host-prober — Phase 0 stub
// Phase 1 implementation: discovery probing + route-liveness checks.
// THE ONLY MODULE allowed to contact a user-supplied host URL.
// Owns all SSRF protections: private IP blocking, cloud metadata IP blocking,
// DNS-rebind checks, redirect validation, timeouts, size caps.
// Security tests required before any Phase 1 PR merges.
// CI-enforced: may NOT import a DB client or LLM client.

export interface ProbeTarget {
  hostUrl: string;
  timeoutMs?: number;
}

export interface ProbeResult {
  reachable: boolean;
  discoveredSpecUrl?: string;
  liveRouteSample?: string[];
  error?: string;
}

// Placeholder — full SSRF-hardened implementation in Phase 1
export type { ProbeTarget as HostProbeTarget, ProbeResult as HostProbeResult };
