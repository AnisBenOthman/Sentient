import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ChannelType } from '@sentient/shared';

export class GenerateLinkCodeDto {
  @ApiProperty({ enum: ChannelType, example: ChannelType.TELEGRAM })
  @IsEnum(ChannelType)
  channel!: ChannelType;
}
