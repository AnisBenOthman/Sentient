import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class NotifySlackDto {
  @ApiProperty({ description: 'Slack user id (channel_identities.externalId), resolved by the caller' })
  @IsString()
  @MinLength(1)
  externalId!: string;

  @ApiProperty({ description: 'Plain-text message body (mrkdwn is left to Slack defaults, no blocks)' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
