import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitCheckInDto {
  @ApiProperty({ description: 'UUID of the Key Result being checked in' })
  @IsUUID()
  keyResultId!: string;

  @ApiProperty({ description: 'New current value as decimal string (precision: 4 decimal digits)', example: '75.0000' })
  @IsDecimal({ decimal_digits: '0,4' })
  value!: string;

  @ApiPropertyOptional({ description: 'Optional comment (max 2000 chars)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
