import {
  IsDateString,
  IsDecimal,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, EducationLevel, MaritalStatus, SalaryChangeReason } from '@sentient/shared';

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ description: 'New gross salary' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  grossSalary?: string;

  @ApiPropertyOptional({ description: 'New net salary' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  netSalary?: string;

  @ApiPropertyOptional({
    enum: SalaryChangeReason,
    description: 'Required when grossSalary is provided',
  })
  // WHY: salaryChangeReason is required when the gross salary changes.
  // Cross-field validation enforced at the DTO boundary so services trust their inputs.
  @ValidateIf((o: UpdateEmployeeDto) => o.grossSalary !== undefined)
  @IsEnum(SalaryChangeReason)
  salaryChangeReason?: SalaryChangeReason;

  @ApiPropertyOptional({
    description: 'Required when salaryChangeReason is OTHER',
    maxLength: 500,
  })
  @ValidateIf((o: UpdateEmployeeDto) => o.salaryChangeReason === SalaryChangeReason.OTHER)
  @IsString()
  @MaxLength(500)
  salaryChangeComment?: string;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  educationField?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
