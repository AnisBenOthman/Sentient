import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty({ example: 'Software Engineer', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  title!: string;

  @ApiPropertyOptional({
    example: 'Senior',
    minLength: 1,
    maxLength: 50,
    description: 'Seniority level, e.g. Junior, Senior, Lead',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  level?: string;
}
