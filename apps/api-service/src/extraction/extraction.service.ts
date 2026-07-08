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

  async submit(dto: SubmitExtractionDto, _userId: string) {
    // Create run record in 'pending' state
    const run = await this.prisma.extractionRun.create({
      data: {
        repositoryUrl: dto.repositoryUrl,
        commitSha: dto.commitSha ?? 'HEAD',
        parserName: dto.parserName ?? 'express',
        parserVersion: '1.0.0',
        status: 'pending',
      },
    });

    // Enqueue the job
    await this.getQueue().add('extract', {
      extractionRunId: run.id,
      repositoryUrl: dto.repositoryUrl,
      commitSha: dto.commitSha ?? 'HEAD',
      parserName: dto.parserName ?? 'express',
      hostUrl: dto.hostUrl,
    });

    return { id: run.id, status: run.status };
  }

  async findOne(id: string): Promise<object> {
    const run = await this.prisma.extractionRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`ExtractionRun ${id} not found`);
    return run;
  }

  async list(_userId: string): Promise<object[]> {
    // Phase 3: filter by organisation. For now return recent runs.
    return this.prisma.extractionRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
