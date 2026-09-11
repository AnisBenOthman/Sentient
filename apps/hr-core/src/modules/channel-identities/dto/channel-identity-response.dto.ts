import { ApiProperty } from '@nestjs/swagger';
import { ChannelType } from '@sentient/shared';

export class ChannelIdentityResponseDto {
  @ApiProperty({ enum: ChannelType })
  channel!: ChannelType;

  @ApiProperty({ description: 'Bot-side identity (Telegram chatId, Slack userId) — not a secret' })
  externalId!: string;

  @ApiProperty()
  linkedAt!: Date;
}
