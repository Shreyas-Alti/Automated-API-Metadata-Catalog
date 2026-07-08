import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExtractionService } from '../extraction/extraction.service';
import { ReviewService } from '../review/review.service';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../database/prisma.service';

const ORG_A = 'org-a-uuid';
const ORG_B = 'org-b-uuid';

// ─── minimal Prisma mock ──────────────────────────────────────────────────────
function makePrismaMock() {
  return {
    extractionRun: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    endpoint: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    apiVersion: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    api: { findFirst: jest.fn().mockResolvedValue(null) },
    evidenceRecord: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('Multi-tenant isolation', () => {
  let extractionService: ExtractionService;
  let reviewService: ReviewService;
  let catalogService: CatalogService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtractionService,
        ReviewService,
        CatalogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    extractionService = module.get(ExtractionService);
    reviewService = module.get(ReviewService);
    catalogService = module.get(CatalogService);
  });

  // ─── ExtractionService ───────────────────────────────────────────────────

  describe('ExtractionService', () => {
    it('findOne: org-A JWT cannot access org-B run — returns 404', async () => {
      // prisma returns null (org-B run is invisible to org-A)
      await expect(extractionService.findOne('run-from-org-b', ORG_A)).rejects.toThrow(NotFoundException);
    });

    it('findOne: WHERE clause always includes organisationId', async () => {
      await extractionService.findOne('some-run', ORG_A).catch(() => {});
      expect(prisma.extractionRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organisationId: ORG_A }) }),
      );
    });

    it('list: query is scoped to org-A only', async () => {
      await extractionService.list('user-1', ORG_A);
      expect(prisma.extractionRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organisationId: ORG_A }) }),
      );
    });

    it('list: org-A and org-B are called with different WHERE clauses (no bleed)', async () => {
      await extractionService.list('user-a', ORG_A);
      await extractionService.list('user-b', ORG_B);
      const calls = prisma.extractionRun.findMany.mock.calls;
      expect(calls[0][0].where.organisationId).toBe(ORG_A);
      expect(calls[1][0].where.organisationId).toBe(ORG_B);
    });
  });

  // ─── ReviewService ────────────────────────────────────────────────────────

  describe('ReviewService', () => {
    it('getReview: org-A JWT cannot access org-B review — returns 404', async () => {
      await expect(reviewService.getReview('run-from-org-b', ORG_A)).rejects.toThrow(NotFoundException);
    });

    it('listPendingReviews: WHERE clause scopes to org AND status', async () => {
      await reviewService.listPendingReviews(ORG_A);
      expect(prisma.extractionRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'review_required',
            organisationId: ORG_A,
          }),
        }),
      );
    });

    it('editEndpoint: field allowlist rejects disallowed fields before any DB query', async () => {
      // Should throw BadRequestException immediately — no DB calls needed
      await expect(
        reviewService.editEndpoint('run-1', 'ep-1', { field: 'apiId', value: 'steal' }, 'user', ORG_A),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.extractionRun.findFirst).not.toHaveBeenCalled();
    });

    it('editEndpoint: org-A JWT cannot edit org-B endpoint — returns 404', async () => {
      // Run exists and belongs to org-A
      prisma.extractionRun.findFirst.mockResolvedValueOnce({ id: 'run-1', status: 'review_required' });
      // But endpoint lookup (with org+run filter) returns null — endpoint is org-B's
      prisma.endpoint.findFirst.mockResolvedValueOnce(null);

      await expect(
        reviewService.editEndpoint('run-1', 'ep-org-b', { field: 'summary', value: 'hacked' }, 'user', ORG_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('editEndpoint: endpoint lookup includes organisationId AND extractionRunId filter (IDOR guard)', async () => {
      prisma.extractionRun.findFirst.mockResolvedValueOnce({ id: 'run-1', status: 'review_required' });

      await reviewService
        .editEndpoint('run-1', 'ep-1', { field: 'summary', value: 'ok' }, 'user', ORG_A)
        .catch(() => {});

      expect(prisma.endpoint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            api: expect.objectContaining({
              organisationId: ORG_A,
              versions: { some: { extractionRunId: 'run-1' } },
            }),
          }),
        }),
      );
    });
  });

  // ─── CatalogService ───────────────────────────────────────────────────────

  describe('CatalogService', () => {
    it('listPublished: query filters by organisationId', async () => {
      await catalogService.listPublished(ORG_A);
      expect(prisma.apiVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishedAt: { not: null },
            api: expect.objectContaining({ organisationId: ORG_A }),
          }),
        }),
      );
    });

    it('findOne: org-A cannot access org-B API — returns 404', async () => {
      prisma.api.findFirst.mockResolvedValueOnce(null);
      await expect(catalogService.findOne('api-from-org-b', ORG_A)).rejects.toThrow(NotFoundException);
    });

    it('findOne: WHERE clause includes organisationId', async () => {
      await catalogService.findOne('some-api', ORG_A).catch(() => {});
      expect(prisma.api.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'some-api', organisationId: ORG_A }),
        }),
      );
    });
  });
});
