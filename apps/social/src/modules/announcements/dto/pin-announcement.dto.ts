import { Allow, IsISO8601, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinAnnouncementDto {
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'ISO-8601 future datetime to pin until. Pass null to clear the pin.',
  })
  @ValidateIf((o: PinAnnouncementDto) => o.pinnedUntil !== null)
  @IsISO8601()
  @Allow()
  pinnedUntil!: string | null;
}
