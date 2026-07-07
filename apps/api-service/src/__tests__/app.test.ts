import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('api-service AppModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });
});
