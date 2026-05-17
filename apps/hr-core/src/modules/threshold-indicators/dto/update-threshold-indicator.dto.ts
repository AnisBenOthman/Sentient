import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateThresholdIndicatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  warningBelow?: number | null;

  @IsOptional()
  @IsNumber()
  criticalBelow?: number | null;
}
