import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { ChannelType } from '@sentient/shared';

export class RedeemLinkCodeDto {
  @ApiProperty({ enum: ChannelType, example: ChannelType.TELEGRAM })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiProperty({ description: 'Telegram chatId or Slack userId — the bot-side identity to link' })
  @IsString()
  @Length(1, 128)
  externalId!: string;

  @ApiProperty({ description: '6-digit one-time code the user obtained from the web app' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}
