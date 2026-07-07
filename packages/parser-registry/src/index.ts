import * as fs from 'fs';
import * as path from 'path';
import type { ExtractionResult, ParserCapabilities } from '@api-catalog/contracts';

export type FrameworkName = 'express' | 'fastapi' | 'spring';

/** The contract every parser plugin must satisfy. */
export interface IParser {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ParserCapabilities;
  parse(repoPath: string, commitSha: string): Promise<ExtractionResult>;
}

// Module-level registry — populated by registerParser calls at startup
const _registry = new Map<FrameworkName, IParser>();

/** Register a parser implementation for a given framework. */
export function registerParser(framework: FrameworkName, parser: IParser): void {
  _registry.set(framework, parser);
}

/** Return the registered parser for a framework, or undefined if not registered. */
export function getParser(framework: FrameworkName): IParser | undefined {
  return _registry.get(framework);
}

/** List all registered framework names. */
export function listRegistered(): FrameworkName[] {
  return Array.from(_registry.keys());
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Inspect a repo's package.json to determine which framework it uses.
 * Returns null if the framework cannot be determined.
 */
export function detectFramework(repoPath: string): FrameworkName | null {
  const pkgPath = path.join(repoPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson;
  } catch {
    return null;
  }

  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  if ('express' in allDeps) return 'express';
  // Future: fastapi (Python — requires separate detection), spring
  return null;
}

