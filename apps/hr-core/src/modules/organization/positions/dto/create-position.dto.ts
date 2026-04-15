import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { KeyPositionRisk, PositionLevel } from '@sentient/shared';

export class CreatePositionDto {
  @ApiProperty({ example: 'Software Engineer', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  title!: string;

  @ApiPropertyOptional({
    enum: PositionLevel,
    example: PositionLevel.SENIOR_1,
    description: 'Seniority level',
  })
  @IsOptional()
  @IsEnum(PositionLevel)
  level?: PositionLevel;

  @ApiPropertyOptional({
    description: 'Mark this position as critical to business continuity',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isKeyPosition?: boolean;

  @ApiPropertyOptional({
    enum: KeyPositionRisk,
    description: 'Vacancy risk level — only meaningful when isKeyPosition is true',
  })
  @IsOptional()
  @IsEnum(KeyPositionRisk)
  keyPositionRisk?: KeyPositionRisk;

  @ApiPropertyOptional({
    description: 'Whether a designated successor has been identified',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hasSuccessor?: boolean;
}
