import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchAgentAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  agentRiskAssessment?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  agentSuggestedDates?: Record<string, unknown>;
}
