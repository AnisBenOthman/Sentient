import { Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RbacGuard, SharedJwtGuard } from '@sentient/shared';
import { UserStatusGuard } from '../guards/user-status.guard';
import { SessionsService } from '../services/sessions.service';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Delete('all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all active sessions for the current user' })
  async revokeAll(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.sessions.revokeAllForUser(user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session (must belong to the caller)' })
  async revokeOne(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.sessions.revokeByIdForUser(sessionId, user.sub);
  }
}
