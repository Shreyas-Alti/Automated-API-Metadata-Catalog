import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { runExtraction } from '@api-catalog/core-extraction-engine';
import { enrichEndpoint } from '@api-catalog/llm-enrichment';
import { PrismaService } from '../database/prisma.service';

export interface ExtractionJobData {
  extractionRunId: string;
  repositoryUrl: string;
  commitSha: string;
  parserName: string;
  hostUrl?: string;
  organisationId: string;
}

@Injectable()
export class ExtractionProcessor {
  private readonly logger = new Logger(ExtractionProcessor.name);
  private worker: Worker | null = null;

  constructor(private readonly prisma: PrismaService) {}

  startWorker() {
    this.worker = new Worker(
      'extraction',
      async (job: Job<ExtractionJobData>) => this.process(job),
      {
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
        },
        concurrency: parseInt(process.env['WORKER_CONCURRENCY'] ?? '2'),
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed (run: ${job.data.extractionRunId})`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Extraction worker started');
  }

  async stopWorker() {
    await this.worker?.close();
  }

  /**
   * Process one extraction job.
   * Contract: this method calls the SAME public interface as the CLI.
   * It must NOT re-implement extraction logic.
   */
  private async process(job: Job<ExtractionJobData>): Promise<void> {
    const { extractionRunId, repositoryUrl, commitSha, parserName, hostUrl, organisationId } = job.data;

    this.logger.log(`Processing extraction job for run ${extractionRunId}`);

    // Update run to 'running'
    await this.prisma.extractionRun.update({ where: { id: extractionRunId }, data: { status: 'running' } });

    try {
      const result = await runExtraction({
        repositoryUrl,
        commitSha,
        parserName,
        // No localRepoPath — engine will clone via repository-loader
        hostUrl,
        apiName: repositoryUrl.split('/').pop() ?? 'unknown',
      });

      // Persist the canonical graph to the database
      await this.persistGraph(result, extractionRunId, organisationId);

      // --- LLM enrichment (optional — only if OPENAI_API_KEY is configured) ---
      // Output is persisted as evidence records (source: 'llm-enrichment',
      // verificationStatus: 'ai-suggested') — NOT written directly to the
      // canonical Endpoint entity. This preserves the evidence-ledger distinction:
      // reviewers see AI suggestions as tagged provenance, not as already-accepted
      // canonical values. Endpoint.summary/description remain null until a human
      // explicitly accepts/edits them through the review UI.
      const apiKey = process.env['OPENAI_API_KEY'];
      if (apiKey) {
        this.logger.log(`Running LLM enrichment for ${result.graph.endpoints.length} endpoints`);
        for (const endpoint of result.graph.endpoints) {
          try {
            const enrichResult = await enrichEndpoint(
              {
                endpointId: endpoint.id,
                extractionRunId,
                structuredContext: { method: endpoint.method, path: endpoint.path, tags: endpoint.tags },
              },
              { apiKey },
            );
            // Persist each piece of evidence through the evidence ledger table
            for (const ev of enrichResult.evidence) {
              await this.prisma.evidenceRecord.create({
                data: {
                  extractionRunId: ev.extractionRunId,
                  endpointId: ev.endpointId,
                  field: ev.field,
                  value: ev.value as object,
                  source: ev.source,           // 'llm-enrichment'
                  verificationStatus: ev.verificationStatus,  // 'ai-suggested'
                },
              });
            }
          } catch (err) {
            this.logger.warn(`LLM enrichment failed for ${endpoint.method} ${endpoint.path}: ${(err as Error).message}`);
          }
        }
      }

      // Update run status
      await this.prisma.extractionRun.update({
        where: { id: extractionRunId },
        data: { status: result.run.status, gateOutcome: result.run.gateOutcome as object ?? undefined },
      });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      const status = msg.includes('Parser error') ? 'parser_error'
        : msg.includes('Validation failed') ? 'validation_failed'
        : msg.includes('Quality gate') ? 'quality_gate_failed'
        : 'parser_error';

      await this.prisma.extractionRun.update({
        where: { id: extractionRunId },
        data: { status },
      });

      throw err; // let BullMQ handle retry
    }
  }

  private async persistGraph(result: Awaited<ReturnType<typeof runExtraction>>, runId: string, organisationId: string) {
    const { graph } = result;

    // Upsert repository
    const repo = await this.prisma.repository.upsert({
      where: { url: graph.repository.url },
      create: { url: graph.repository.url, name: graph.repository.name },
      update: { name: graph.repository.name },
    });

    // Create API — scoped to the submitting organisation
    const api = await this.prisma.api.create({
      data: {
        repositoryId: repo.id,
        name: graph.api.name,
        hostUrl: graph.api.hostUrl,
        organisationId,
      },
    });

    // Create endpoints
    for (const ep of graph.endpoints) {
      const endpoint = await this.prisma.endpoint.create({
        data: {
          apiId: api.id,
          method: ep.method,
          path: ep.path,
          operationId: ep.operationId,
          summary: ep.summary,
          description: ep.description,
          tags: ep.tags ?? [],
        },
      });

      // Create responses for this endpoint
      const endpointResponses = graph.responses.filter((r) => r.endpointId === ep.id);
      for (const resp of endpointResponses) {
        await this.prisma.response.create({
          data: {
            endpointId: endpoint.id,
            statusCode: resp.statusCode,
            description: resp.description,
            content: resp.content as object ?? undefined,
          },
        });
      }

      // Create auth entities
      const endpointAuths = graph.auths.filter((a) => a.endpointId === ep.id);
      for (const auth of endpointAuths) {
        await this.prisma.auth.create({
          data: {
            endpointId: endpoint.id,
            type: auth.type,
            scheme: auth.scheme,
            scopes: auth.scopes ?? [],
            verifiedByHuman: auth.verifiedByHuman,
          },
        });
      }
    }

    // Create API version
    await this.prisma.apiVersion.create({
      data: { apiId: api.id, extractionRunId: runId, version: `express-1.0.0` },
    });
  }
}
