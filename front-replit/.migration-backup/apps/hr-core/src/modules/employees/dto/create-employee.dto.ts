import {
  IsDateString,
  IsDecimal,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, EducationLevel, MaritalStatus } from '@sentient/shared';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Anis' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Ben Othman' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'anis@sentient.dev' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+213555000111' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  hireDate!: string;

  @ApiProperty({ enum: ContractType, example: ContractType.FULL_TIME })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @ApiPropertyOptional({ example: '75000.00', description: 'Gross salary' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  grossSalary?: string;

  @ApiPropertyOptional({ example: '62000.00', description: 'Net salary' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  netSalary?: string;

  @ApiPropertyOptional({ enum: MaritalStatus, example: MaritalStatus.SINGLE })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ enum: EducationLevel, example: EducationLevel.BACHELOR })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional({ example: 'Computer Science', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  educationField?: string;

  @ApiPropertyOptional({ example: 'uuid-of-position' })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-department' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-team' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-manager' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ example: 'EMP-0042', description: 'Auto-generated if omitted' })
  @IsOptional()
  @IsString()
  @Matches(/^EMP-\d+$/, { message: 'employeeCode must match EMP-XXXX format' })
  employeeCode?: string;
}
