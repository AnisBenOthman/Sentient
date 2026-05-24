import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccrualFrequency } from '@sentient/shared';

function IsCarryoverWithinDefault(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCarryoverWithinDefault',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as { defaultDaysPerYear?: number };
          if (typeof value !== 'number' || typeof obj.defaultDaysPerYear !== 'number') return true;
          return value <= obj.defaultDaysPerYear;
        },
        defaultMessage(): string {
          return 'maxCarryoverDays must be <= defaultDaysPerYear';
        },
      },
    });
  };
}

export class CreateLeaveTypeDto {
  @ApiProperty()
  @IsUUID()
  businessUnitId: string = '';

  @ApiProperty()
  @IsString()
  name: string = '';

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Max(366)
  defaultDaysPerYear: number = 0;

  @ApiPropertyOptional({ enum: AccrualFrequency })
  @IsOptional()
  @IsEnum(AccrualFrequency)
  accrualFrequency?: AccrualFrequency;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @IsCarryoverWithinDefault()
  maxCarryoverDays: number = 0;

  @ApiProperty({ default: true })
  @IsBoolean()
  requiresApproval: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color, e.g. #4CAF50' })
  color?: string;
}
