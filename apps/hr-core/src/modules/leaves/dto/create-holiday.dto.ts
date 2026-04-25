import {
  IsBoolean,
  IsDateString,
  IsString,
  IsUUID,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function IsValidHolidayYear(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isValidHolidayYear',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as { isRecurring?: boolean; date?: string };
          if (obj.isRecurring === true) {
            // recurring → year must be null (not provided)
            return _value === null || _value === undefined;
          }
          // non-recurring → year must match date's year
          if (!obj.date) return true;
          const dateYear = new Date(obj.date).getUTCFullYear();
          return _value === dateYear;
        },
        defaultMessage(args: ValidationArguments): string {
          const obj = args.object as { isRecurring?: boolean };
          return obj.isRecurring
            ? 'year must be null when isRecurring is true'
            : 'year must match the year of the date field';
        },
      },
    });
  };
}

export class CreateHolidayDto {
  @ApiProperty()
  @IsUUID()
  businessUnitId: string = '';

  @ApiProperty()
  @IsString()
  name: string = '';

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  date: string = '';

  @ApiProperty({ default: false })
  @IsBoolean()
  isRecurring: boolean = false;

  @ApiProperty({ nullable: true, required: false })
  @IsValidHolidayYear()
  year?: number | null;
}
