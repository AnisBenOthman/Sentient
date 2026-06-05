import { Module } from '@nestjs/common';
import { KnowledgeRepository } from './knowledge.repository';

@Module({
  providers: [KnowledgeRepository],
  exports: [KnowledgeRepository],
})
export class KnowledgeModule {}
