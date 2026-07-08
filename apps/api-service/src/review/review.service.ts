import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PrismaAuditLog } from '@api-catalog/audit-log';

export interface EditEndpointDto {
  field: string;
  value: string;
}

// Only these fields can be edited through the review endpoint.
// Prevents a client from overwriting id, apiId, createdAt, or reassigning endpoints.
const EDITABLE_ENDPOINT_FIELDS = new Set(['summary', 'description', 'operationId', 'tags']);

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listPendingReviews(): Promise<object[]> {
    return this.prisma.extractionRun.findMany({
      where: { status: 'review_required' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReview(runId: string): Promise<object> {
    const run = await this.prisma.extractionRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`ExtractionRun ${runId} not found`);
    if (!['review_required', 'published'].includes(run.status)) {
      throw new BadRequestException(`Run ${runId} is not in review state (status: ${run.status})`);
    }

    // Find the API extracted in this run
    const version = await this.prisma.apiVersion.findFirst({
      where: { extractionRunId: runId },
      include: {
        api: {
          include: {
            endpoints: { include: { responses: true, auths: true } },
          },
        },
      },
    });

    const evidence = await this.prisma.evidenceRecord.findMany({ where: { extractionRunId: runId } });

    return { run, api: version?.api ?? null, evidence };
  }

  async editEndpoint(runId: string, endpointId: string, dto: EditEndpointDto, reviewerId: string) {
    // Validate field is in the allowlist — prevents overwriting id, apiId, etc.
    if (!EDITABLE_ENDPOINT_FIELDS.has(dto.field)) {
      throw new BadRequestException(
        `Field '${dto.field}' is not editable. Allowed fields: ${Array.from(EDITABLE_ENDPOINT_FIELDS).join(', ')}`,
      );
    }

    const run = await this.prisma.extractionRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`ExtractionRun ${runId} not found`);

    const endpoint = await this.prisma.endpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) throw new NotFoundException(`Endpoint ${endpointId} not found`);

    // Record the old value for audit
    const oldValue = (endpoint as Record<string, unknown>)[dto.field];

    // Apply the edit to the canonical graph entity
    await this.prisma.endpoint.update({
      where: { id: endpointId },
      data: { [dto.field]: dto.value },
    });

    // Write to audit log
    const auditLog = new PrismaAuditLog(this.prisma);
    await auditLog.record({
      kind: 'human-edit',
      extractionRunId: runId,
      endpointId,
      field: dto.field,
      oldValue,
      newValue: dto.value,
      reviewerId,
      timestamp: new Date(),
    });

    return { ok: true, endpointId, field: dto.field };
  }

  async publish(runId: string, _reviewerId: string) {
    const run = await this.prisma.extractionRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`ExtractionRun ${runId} not found`);
    if (run.status !== 'review_required') {
      throw new BadRequestException(`Run ${runId} is not in review_required state`);
    }

    // Transition to published
    const updated = await this.prisma.extractionRun.update({
      where: { id: runId },
      data: { status: 'published' },
    });

    // Mark version as published
    await this.prisma.apiVersion.updateMany({
      where: { extractionRunId: runId },
      data: { publishedAt: new Date() },
    });

    return { id: updated.id, status: updated.status };
  }
}
