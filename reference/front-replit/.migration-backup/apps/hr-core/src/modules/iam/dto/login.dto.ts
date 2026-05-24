import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ChannelType } from '@sentient/shared';

export class LoginDto {
  @ApiProperty({ example: 'admin@sentient.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngP@ssw0rd' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ChannelType, default: ChannelType.WEB })
  @IsEnum(ChannelType)
  channel: ChannelType = ChannelType.WEB;
}
