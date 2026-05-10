import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Backend', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({
    example: 'ENG-BE',
    minLength: 2,
    maxLength: 20,
    description: 'Optional unique team code',
  })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  code?: string;

  @ApiPropertyOptional({ example: 'Core backend services', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ format: 'uuid', description: 'Parent department ID (must be active)' })
  @IsUUID()
  departmentId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'UUID of the team lead (Employee)' })
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @ApiPropertyOptional({ example: 'Payment Gateway v2', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectFocus?: string;
}
