import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { ChannelType, JwtPayload } from '@sentient/shared';
import { AiActorContext } from './agent-graph.types';
import { AI_USER_ROLES } from './ai-user-roles';

interface RequestWithActor extends Request {
  user?: JwtPayload;
  correlationId?: string;
}

/**
 * The ONE place an AiActorContext is constructed. Two entry points, one mapping:
 * fromRequest() for HTTP (SharedJwtGuard has already verified the token and
 * populated request.user) and fromChannelToken() for chat channels, where no
 * guard ran and this factory must verify the token itself.
 */
@Injectable()
export class ActorContextFactory {
  constructor(private readonly config: ConfigService) {}

  fromRequest(request: RequestWithActor): AiActorContext {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Missing authenticated user context');

    const token = this.extractJwt(request);
    if (!token) throw new UnauthorizedException('Missing forwarded JWT');

    return this.toActor(
      user,
      token,
      request.correlationId ?? this.headerValue(request, 'x-correlation-id') ?? 'missing',
    );
  }

  /**
   * Builds the actor for a message that arrived over a chat channel.
   *
   * WHY verify, never decode: a channel adapter calling ConversationsService
   * directly bypasses every HTTP guard, so this is the only signature check the
   * token will ever get. JWT_SECRET is shared with HR Core, which minted the
   * token via the channel-identity exchange, so local verification is real.
   *
   * The two extra assertions are exactly what the HTTP pipeline would have done:
   * the token must have been issued for THIS channel (a WEB token replayed at
   * the bot is refused), and the roles must permit the assistant at all —
   * mirroring @Roles(...AI_USER_ROLES) on ConversationsController.
   */
  fromChannelToken(accessToken: string, options: { channel: ChannelType; correlationId: string }): AiActorContext {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');

    let payload: JwtPayload;
    try {
      payload = jwt.verify(accessToken, secret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Channel session token is invalid or expired');
    }

    if (payload.channel !== options.channel) {
      throw new UnauthorizedException(`Token was issued for ${payload.channel}, not ${options.channel}`);
    }
    if (!Array.isArray(payload.roles) || !payload.roles.some((role) => AI_USER_ROLES.includes(role))) {
      throw new ForbiddenException('Account is not permitted to use the AI assistant');
    }

    return this.toActor(payload, accessToken, options.correlationId);
  }

  private toActor(user: JwtPayload, token: string, correlationId: string): AiActorContext {
    return {
      jwt: token,
      userId: user.sub,
      employeeId: user.employeeId,
      roles: [...user.roles],
      departmentId: user.departmentId,
      teamId: user.teamId,
      businessUnitId: user.businessUnitId,
      roleAssignments: [...(user.roleAssignments ?? [])],
      correlationId,
    };
  }

  private extractJwt(request: Request): string | null {
    const authorization = this.headerValue(request, 'authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    return authorization.slice(7);
  }

  private headerValue(request: Request, name: string): string | null {
    const raw = request.headers[name];
    if (Array.isArray(raw)) return raw[0] ?? null;
    return typeof raw === 'string' ? raw : null;
  }
}
