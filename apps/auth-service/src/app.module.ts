import 'reflect-metadata';
import { Module } from '@nestjs/common';

// auth-service — Phase 0 stub
// Phase 2 implementation: basic auth (single org/tenant).
// Phase 3 implementation: full org/team RBAC.
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
