import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerAccrualDto {
  @ApiProperty({ example: '2026-04', description: 'Month to run accrual for (YYYY-MM)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month: string = '';
}
