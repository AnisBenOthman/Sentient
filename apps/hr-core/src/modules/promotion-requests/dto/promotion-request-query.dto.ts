import { ApiPropertyOptional } from '@nestjs/swagger';
import { PromotionRequestStatus } from '@sentient/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class PromotionRequestQueryDto {
  @ApiPropertyOptional({ minimum: 2000, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ enum: PromotionRequestStatus })
  @IsOptional()
  @IsEnum(PromotionRequestStatus)
  status?: PromotionRequestStatus;
}
