import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  clientContext?: Record<string, unknown>;
}
