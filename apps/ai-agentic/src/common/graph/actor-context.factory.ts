import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '@sentient/shared';
import { AiActorContext } from './agent-graph.types';

interface RequestWithActor extends Request {
  user?: JwtPayload;
  correlationId?: string;
}

@Injectable()
export class ActorContextFactory {
  fromRequest(request: RequestWithActor): AiActorContext {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Missing authenticated user context');

    const jwt = this.extractJwt(request);
    if (!jwt) throw new UnauthorizedException('Missing forwarded JWT');

    return {
      jwt,
      userId: user.sub,
      employeeId: user.employeeId,
      roles: [...user.roles],
      departmentId: user.departmentId,
      teamId: user.teamId,
      businessUnitId: user.businessUnitId,
      correlationId: request.correlationId ?? this.headerValue(request, 'x-correlation-id') ?? 'missing',
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
