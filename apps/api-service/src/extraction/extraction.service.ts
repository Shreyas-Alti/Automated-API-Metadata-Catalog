import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';

export interface SubmitExtractionDto {
  repositoryUrl: string;
  commitSha?: string;
  parserName?: string;
  hostUrl?: string;
}

export const EXTRACTION_QUEUE = 'extraction';

@Injectable()
export class ExtractionService {
  private queue: Queue | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(EXTRACTION_QUEUE, {
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
          lazyConnect: true,
        },
      });
    }
    return this.queue;
  }

  async submit(dto: SubmitExtractionDto, _userId: string, organisationId: string) {
    // Create run record in 'pending' state, scoped to the submitting organisation
    const run = await this.prisma.extractionRun.create({
      data: {
        repositoryUrl: dto.repositoryUrl,
        commitSha: dto.commitSha ?? 'HEAD',
        parserName: dto.parserName ?? 'express',
        parserVersion: '1.0.0',
        status: 'pending',
        organisationId,
      },
    });

    // Enqueue the job — include organisationId so the worker can scope Api creation
    await this.getQueue().add('extract', {
      extractionRunId: run.id,
      repositoryUrl: dto.repositoryUrl,
      commitSha: dto.commitSha ?? 'HEAD',
      parserName: dto.parserName ?? 'express',
      hostUrl: dto.hostUrl,
      organisationId,
    });

    return { id: run.id, status: run.status };
  }

  async findOne(id: string, organisationId: string): Promise<object> {
    const run = await this.prisma.extractionRun.findFirst({
      where: { id, organisationId },
    });
    if (!run) throw new NotFoundException(`ExtractionRun ${id} not found`);
    return run;
  }

  async list(_userId: string, organisationId: string): Promise<object[]> {
    return this.prisma.extractionRun.findMany({
      where: { organisationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
