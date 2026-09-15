import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class NotifyTelegramDto {
  @ApiProperty({ description: 'Telegram chat id (channel_identities.externalId), resolved by the caller' })
  @IsString()
  @MinLength(1)
  externalId!: string;

  @ApiProperty({ description: 'Plain-text message body — no parse_mode, matches the inbound handlers' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}
