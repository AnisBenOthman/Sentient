import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtPayload, Public, RbacGuard, SharedJwtGuard } from '@sentient/shared';
import { Request } from 'express';
import { ClaimInviteDto } from '../dto/claim-invite.dto';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UserStatusGuard } from '../guards/user-status.guard';
import { AuthService } from '../services/auth.service';
import { InviteService } from '../services/invite.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly invite: InviteService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and obtain JWT + refresh token' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.auth.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.auth.refresh(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('invite/claim')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Claim an invite token and set initial password — activates account' })
  @ApiResponse({ status: 204, description: 'Account activated' })
  @ApiResponse({ status: 400, description: 'Invalid / expired token or password policy violation' })
  async claimInvite(@Body() dto: ClaimInviteDto): Promise<void> {
    await this.invite.claim(dto);
  }

  @Post('logout')
  @UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.auth.logout(user.sessionId, user.sub);
  }
}
