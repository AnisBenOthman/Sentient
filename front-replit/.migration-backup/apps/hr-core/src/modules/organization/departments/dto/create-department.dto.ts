import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    example: 'ENG',
    minLength: 2,
    maxLength: 10,
    description: 'Short alphanumeric code, e.g. ENG, HR, PRD',
  })
  @IsString()
  @Length(2, 10)
  code!: string;

  @ApiPropertyOptional({ example: 'Product engineering teams', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID of the department head (active Employee)',
  })
  @IsOptional()
  @IsUUID()
  headId?: string;

  @ApiProperty({
    format: 'uuid',
    description: 'UUID of the business unit this department belongs to',
  })
  @IsUUID()
  businessUnitId!: string;
}
