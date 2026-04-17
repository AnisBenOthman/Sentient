import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { SourceLevel } from '@sentient/shared';

// WHY: Enforce "at least one scope filter" at the DTO layer so the rule
// lives with the contract instead of being re-checked in every controller.
function AtLeastOneScope(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'atLeastOneScope',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const o = args.object as HistoryQueryDto;
          return Boolean(o.employeeId || o.teamId || o.departmentId || o.skillId);
        },
        defaultMessage(): string {
          return 'At least one of employeeId, teamId, departmentId, skillId must be provided';
        },
      },
    });
  };
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by employee' })
  @IsOptional()
  @IsUUID()
  @AtLeastOneScope()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by team' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by department' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by skill' })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({ enum: SourceLevel, description: 'Filter by assessment source' })
  @IsOptional()
  @IsEnum(SourceLevel)
  source?: SourceLevel;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on effectiveDate (ISO date)', format: 'date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on effectiveDate (ISO date)', format: 'date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'Sort order on effectiveDate' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
