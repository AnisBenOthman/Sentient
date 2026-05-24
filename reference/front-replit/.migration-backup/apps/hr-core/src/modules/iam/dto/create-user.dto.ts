import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'alice@sentient.dev' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Employee.id to link — omit for admin-only users' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
