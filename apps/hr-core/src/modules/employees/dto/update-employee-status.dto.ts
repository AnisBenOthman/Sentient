import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus } from '@sentient/shared';

export class UpdateEmployeeStatusDto {
  @ApiProperty({ enum: EmploymentStatus })
  @IsEnum(EmploymentStatus)
  status!: EmploymentStatus;

  @ApiPropertyOptional({
    description: 'Required when status is TERMINATED or RESIGNED',
  })
  // WHY: Legal and HR compliance requires a documented reason for all
  // involuntary and voluntary terminations. Enforced at DTO level so the
  // service never receives an undocumented departure.
  @ValidateIf(
    (o: UpdateEmployeeStatusDto) =>
      o.status === EmploymentStatus.TERMINATED || o.status === EmploymentStatus.RESIGNED,
  )
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
