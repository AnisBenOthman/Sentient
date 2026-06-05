import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AgentType } from '../../../generated/prisma';

export class AgentActivityQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;
}
