import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DashboardMetricKey } from '@sentient/shared';

export class CreateThresholdIndicatorDto {
  @IsEnum(DashboardMetricKey)
  metricKey!: DashboardMetricKey;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  criticalThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  warningBelow?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  criticalBelow?: number;
}
