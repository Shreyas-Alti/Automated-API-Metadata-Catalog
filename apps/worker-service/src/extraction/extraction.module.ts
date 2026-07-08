import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ExtractionProcessor } from './extraction.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ExtractionProcessor],
})
export class ExtractionModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly processor: ExtractionProcessor) {}
  onModuleInit() { this.processor.startWorker(); }
  async onModuleDestroy() { await this.processor.stopWorker(); }
}
