#!/usr/bin/env node
/**
 * extract-api CLI
 * Usage: extract-api --repo <local-path> --commit <sha> --parser express [--output <file>]
 */
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { runExtraction } from './index';

const program = new Command();

program
  .name('extract-api')
  .description('Extract API metadata from a local repository')
  .version('1.0.0')
  .requiredOption('--repo <path>', 'Local path to the repository')
  .requiredOption('--commit <sha>', 'Commit SHA for reproducibility (use HEAD if unknown)')
  .requiredOption('--parser <name>', 'Parser to use (express)')
  .option('--api-name <name>', 'Human-readable API name (defaults to repo directory name)')
  .option('--output <file>', 'Write OpenAPI JSON to this file (defaults to stdout)')
  .action(async (options: { repo: string; commit: string; parser: string; apiName?: string; output?: string }) => {
    const repoPath = path.resolve(options.repo);

    if (!fs.existsSync(repoPath)) {
      process.stderr.write(`Error: repo path does not exist: ${repoPath}\n`);
      process.exit(1);
    }

    try {
      const result = await runExtraction({
        repositoryUrl: `file://${repoPath}`,
        commitSha: options.commit,
        parserName: options.parser,
        localRepoPath: repoPath,
        apiName: options.apiName,
      });

      const output = JSON.stringify(result.openApiDocument, null, 2);

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf-8');
        process.stdout.write(`OpenAPI document written to ${options.output}\n`);
      } else {
        process.stdout.write(output + '\n');
      }

      // Summary to stderr so it doesn't pollute JSON stdout
      process.stderr.write(
        [
          `\nExtraction complete.`,
          `  Run ID   : ${result.run.id}`,
          `  Status   : ${result.run.status}`,
          `  Endpoints: ${result.graph.endpoints.length}`,
          `  Paths    : ${Object.keys(result.openApiDocument.paths).length}`,
          '',
        ].join('\n'),
      );
    } catch (err: unknown) {
      process.stderr.write(`Extraction failed: ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

program.parse(process.argv);
