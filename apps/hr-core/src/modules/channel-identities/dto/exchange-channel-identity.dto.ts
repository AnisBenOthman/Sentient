import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { ChannelType } from '@sentient/shared';

export class ExchangeChannelIdentityDto {
  @ApiProperty({ enum: ChannelType, example: ChannelType.TELEGRAM })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiProperty({ description: 'Telegram chatId or Slack userId — must already be linked' })
  @IsString()
  @Length(1, 128)
  externalId!: string;
}
