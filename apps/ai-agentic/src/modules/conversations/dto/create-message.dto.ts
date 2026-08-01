import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 8000 })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  clientContext?: Record<string, unknown>;

  /**
   * WHY a first-class typed field rather than smuggled through clientContext
   * (spec 017 D3/T020): a confirm is a typed control signal the executor
   * branches on directly, not a message the classifier interprets. True =
   * confirm the pending proposal; false = cancel it. Absent = this turn is a
   * normal message, not a response to a pending confirmation card.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;

  /**
   * WHY IsUUID: AgentActionProposal.token is minted as a UUID
   * (action-proposal.service.ts, spec 017 FR-003). Required alongside
   * `confirmed` — the executor refuses a confirm/cancel with no matching
   * token rather than guessing which pending proposal it refers to.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  confirmationToken?: string;
}
