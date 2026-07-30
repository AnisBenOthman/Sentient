import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentTaskLogService } from '../agents/agent-task-log.service';
import { AnalyticsSqlClient } from './analytics-sql.client';
import { AnalyticsSqlService } from './analytics-sql.service';
import { SqlGeneratorService } from './sql-generator.service';
import { SqlValidatorService } from './sql-validator.service';

/**
 * WHY this module owns AgentTaskLogService rather than importing AgentsModule:
 * AgentsModule imports this one (the supervisor runner routes to
 * AnalyticsSqlService), so importing it back would create a cycle.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    AnalyticsSqlClient,
    AnalyticsSqlService,
    SqlGeneratorService,
    SqlValidatorService,
    AgentTaskLogService,
  ],
  exports: [AnalyticsSqlService, SqlValidatorService, SqlGeneratorService],
})
export class AnalyticsSqlModule {}
