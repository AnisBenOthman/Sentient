import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeesWithoutLeaveQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
