import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Allowed git hosts ────────────────────────────────────────────────────────
//
// Only these hosts are permitted as git clone targets. This prevents SSRF via
// git URLs: without this check, a user could submit https://10.0.0.1/repo.git
// and cause git to connect to an internal network host.
//
// Extend this list deliberately when adding support for self-hosted GitLab/
// GitHub Enterprise — don't remove the check.
export const ALLOWED_GIT_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
]);

export class RepositoryUrlNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryUrlNotAllowedError';
  }
}

/**
 * Validate a repository URL: must be https:// and point to an allowed git host.
 * Returns the parsed URL on success; throws RepositoryUrlNotAllowedError otherwise.
 */
export function validateRepositoryUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RepositoryUrlNotAllowedError(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new RepositoryUrlNotAllowedError(
      `Only https:// repository URLs are allowed (got ${parsed.protocol}): ${url}`,
    );
  }

  if (!ALLOWED_GIT_HOSTS.has(parsed.hostname)) {
    throw new RepositoryUrlNotAllowedError(
      `Repository host '${parsed.hostname}' is not in the allowed list ` +
        `(${Array.from(ALLOWED_GIT_HOSTS).join(', ')}). ` +
        `Add it to ALLOWED_GIT_HOSTS explicitly to enable support.`,
    );
  }

  return parsed;
}

export interface CloneOptions {
  /** Target directory. If omitted, a temp directory is created automatically. */
  targetDir?: string;
  /** Shallow clone depth. Defaults to 1 (latest commit only). */
  depth?: number;
  /** Clone timeout in milliseconds. Defaults to 120 000 (2 min). */
  timeoutMs?: number;
}

export interface CloneResult {
  /** Local path to the cloned repository. */
  localPath: string;
  /** Resolved HEAD commit SHA at the time of clone. */
  commitSha: string;
  /**
   * True if this module created the directory and is responsible for cleanup.
   * Pass this result to cleanupRepository() when done.
   */
  ownsDirectory: boolean;
}

/**
 * Resolve the HEAD commit SHA of an already-checked-out local repository.
 * Returns 'unknown' if git is unavailable or the directory isn't a repo.
 */
export function detectHeadSha(repoDir: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return 'unknown';
}

/**
 * Shallow-clone a repository from an allowed git host.
 *
 * Security: validates the URL against ALLOWED_GIT_HOSTS before invoking git,
 * and uses spawnSync (no shell) to prevent command injection.
 */
export async function cloneRepository(
  url: string,
  options: CloneOptions = {},
): Promise<CloneResult> {
  const parsed = validateRepositoryUrl(url);
  const timeout = options.timeoutMs ?? 120_000;
  const depth = options.depth ?? 1;

  const ownsDirectory = !options.targetDir;
  const targetDir =
    options.targetDir ??
    fs.mkdtempSync(path.join(os.tmpdir(), 'api-catalog-clone-'));

  // spawnSync with an array — no shell, no injection risk
  const result = spawnSync(
    'git',
    ['clone', `--depth=${depth}`, '--', parsed.href, targetDir],
    { timeout, encoding: 'utf-8', stdio: 'pipe' },
  );

  if (result.status !== 0 || result.error) {
    if (ownsDirectory) {
      try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    const stderr = result.stderr ?? result.error?.message ?? 'unknown error';
    throw new Error(`git clone failed for ${url}: ${stderr}`);
  }

  const commitSha = detectHeadSha(targetDir);
  return { localPath: targetDir, commitSha, ownsDirectory };
}

/**
 * Remove a cloned repository directory.
 * Only removes the directory if `result.ownsDirectory` is true (i.e., this
 * module created it — callers that passed their own targetDir are responsible
 * for their own cleanup).
 */
export function cleanupRepository(result: CloneResult): void {
  if (result.ownsDirectory && fs.existsSync(result.localPath)) {
    fs.rmSync(result.localPath, { recursive: true, force: true });
  }
}
