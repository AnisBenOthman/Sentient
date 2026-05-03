import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SkillsGapQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Position to compare against. Defaults to the employee\'s currently assigned position.',
  })
  @IsOptional()
  @IsUUID()
  positionId?: string;
}
