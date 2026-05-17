import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { DashboardMetricKey } from '@sentient/shared';

export class CreateThresholdIndicatorDto {
  @IsEnum(DashboardMetricKey)
  metricKey!: DashboardMetricKey;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsNumber()
  warningBelow?: number;

  @IsOptional()
  @IsNumber()
  criticalBelow?: number;
}
