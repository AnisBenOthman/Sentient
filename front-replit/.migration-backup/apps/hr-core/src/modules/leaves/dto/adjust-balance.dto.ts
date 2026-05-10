import { IsNotEmpty, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustBalanceDto {
  @ApiProperty()
  @IsNumber()
  newTotalDays: number = 0;

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string = '';
}
