import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Audience } from '@sentient/shared';

export class CreateAnnouncementDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @ApiProperty({ enum: Audience })
  @IsEnum(Audience)
  audience!: Audience;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetDepartmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetTeamId?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'ISO-8601 expiry timestamp' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
