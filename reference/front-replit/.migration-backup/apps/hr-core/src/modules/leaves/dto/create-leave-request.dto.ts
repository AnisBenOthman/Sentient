import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HalfDay } from '@sentient/shared';

function IsValidLeaveRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isValidLeaveRange',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as {
            startDate?: string;
            endDate?: string;
            startHalfDay?: HalfDay;
            endHalfDay?: HalfDay;
          };
          if (!obj.startDate || !obj.endDate) return true;
          const start = new Date(obj.startDate);
          const end = new Date(obj.endDate);
          if (end < start) return false;

          // Single-day half-day rules
          if (obj.startDate === obj.endDate) {
            const sh = obj.startHalfDay;
            const eh = obj.endHalfDay;
            // Both null → full day (1.0) — ok
            if (!sh && !eh) return true;
            // Both set to same value → 0.5 morning or afternoon — ok
            if (sh && eh && sh === eh) return true;
            // Any other single-day combination → reject
            return false;
          }
          return true;
        },
        defaultMessage(): string {
          return 'Invalid leave range: endDate must be >= startDate; single-day half-day combinations must be consistent';
        },
      },
    });
  };
}

export class CreateLeaveRequestDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId: string = '';

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  @IsValidLeaveRange()
  startDate: string = '';

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  endDate: string = '';

  @ApiPropertyOptional({ enum: HalfDay })
  @IsOptional()
  @IsEnum(HalfDay)
  startHalfDay?: HalfDay;

  @ApiPropertyOptional({ enum: HalfDay })
  @IsOptional()
  @IsEnum(HalfDay)
  endHalfDay?: HalfDay;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
