import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ExtractionModule } from './extraction/extraction.module';

// worker-service: thin wrapper around core-extraction-engine.
// Consumes BullMQ 'extraction' queue. Calls the same public interface as the CLI.
@Module({
  imports: [ExtractionModule],
})
export class AppModule {}

