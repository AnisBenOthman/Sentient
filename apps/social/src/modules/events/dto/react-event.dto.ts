import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { EVENT_REACTION_EMOJIS, EventReactionEmoji } from '../event-reactions';

export class ReactEventDto {
  @ApiPropertyOptional({
    enum: EVENT_REACTION_EMOJIS,
    nullable: true,
    description: 'Send null or the current emoji again to clear the caller reaction.',
  })
  @IsOptional()
  @IsIn(EVENT_REACTION_EMOJIS)
  emoji?: EventReactionEmoji | null;
}
