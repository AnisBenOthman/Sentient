import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SourceContextDto {
  @ApiProperty({ example: 'LEAVE' })
  sourceType!: string;

  @ApiProperty({ example: 'Leave balance' })
  title!: string;

  @ApiPropertyOptional({ example: 'leave-balance:self' })
  referenceId?: string | null;
}

export interface SourceContext {
  sourceType: string;
  title: string;
  referenceId?: string | null;
}
