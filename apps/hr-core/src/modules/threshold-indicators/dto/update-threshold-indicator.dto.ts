import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateThresholdIndicatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  warningThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  criticalThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  warningBelow?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  criticalBelow?: number | null;
}
