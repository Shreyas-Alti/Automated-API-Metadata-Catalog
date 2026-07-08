import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ExtractionModule } from './extraction/extraction.module';
import { ReviewModule } from './review/review.module';
import { CatalogModule } from './catalog/catalog.module';

// api-service — thin HTTP layer, no business logic.
// Routes: submission, job status, review, publish, catalog browse.
@Module({
  imports: [AuthModule, ExtractionModule, ReviewModule, CatalogModule],
})
export class AppModule {}

