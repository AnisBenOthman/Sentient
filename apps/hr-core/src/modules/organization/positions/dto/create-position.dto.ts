import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PositionLevel } from '@sentient/shared';

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
}
