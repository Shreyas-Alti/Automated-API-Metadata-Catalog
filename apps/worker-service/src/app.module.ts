import 'reflect-metadata';
import { Module } from '@nestjs/common';

// worker-service — Phase 0 stub
// Phase 2 implementation: thin wrapper around core-extraction-engine.
// Consumes BullMQ job queue, calls the same public interface as the CLI.
// Contract test: must call core-extraction-engine's public interface, not a reimplementation.
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
