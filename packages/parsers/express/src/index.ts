import type {
  ExtractionResult,
  ParserCapabilities,
  ExtractionError,
  ExtractionWarning,
} from '@api-catalog/contracts';
import type { IParser } from '@api-catalog/parser-registry';
import { extractRoutesFromSource } from './route-extractor';
import { findSourceFiles, readSourceFile } from './file-finder';

// Capability declaration for parsers/express v1.0.0.
// This file is the single source of truth — never hand-maintain a copy elsewhere.
export const EXPRESS_PARSER_CAPABILITIES: ParserCapabilities = {
  routes: 'supported',
  models: 'not supported',   // Phase 2: schema extraction from TS types
  middleware: 'not supported', // Phase 2: app.use() middleware detection
  auth: 'not supported',
  rateLimits: 'not supported',
} as const;

export const ExpressParser: IParser = {
  name: 'express',
  version: '1.0.0',
  capabilities: EXPRESS_PARSER_CAPABILITIES,

  async parse(repoPath: string, _commitSha: string): Promise<ExtractionResult> {
    const files = findSourceFiles(repoPath);
    const errors: ExtractionError[] = [];
    const warnings: ExtractionWarning[] = [];
    const allRoutes: ExtractionResult['routes'] = [];

    for (const filePath of files) {
      const source = readSourceFile(filePath);
      if (source === null) {
        errors.push({
          file: filePath,
          message: 'Could not read file',
          kind: 'parse_error',
        });
        continue;
      }

      try {
        const routes = extractRoutesFromSource(filePath, source);
        allRoutes.push(...routes);
      } catch (err: unknown) {
        errors.push({
          file: filePath,
          message: err instanceof Error ? err.message : String(err),
          kind: 'parse_error',
        });
      }
    }

    return {
      parserName: 'express',
      parserVersion: '1.0.0',
      capabilities: EXPRESS_PARSER_CAPABILITIES,
      routes: allRoutes,
      schemas: {},
      errors,
      warnings,
    };
  },
};

