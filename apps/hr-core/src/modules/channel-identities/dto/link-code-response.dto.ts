import { ApiProperty } from '@nestjs/swagger';

export class LinkCodeResponseDto {
  @ApiProperty({ description: 'One-time 6-digit code — send it to the bot as /link <code>' })
  code!: string;

  @ApiProperty()
  expiresAt!: Date;
}
