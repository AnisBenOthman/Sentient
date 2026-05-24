import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from './jwt-payload.interface';
import { ROLES_KEY } from './roles.decorator';

// WHY: TEAM_LEAD is a first-class role distinct from MANAGER, but inherits
// all endpoint-level access that MANAGER has. Aliasing here means every
// existing @Roles('MANAGER') decorator automatically allows TEAM_LEAD users
// without touching 30+ controller decorators.
const ROLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  MANAGER: ['TEAM_LEAD'],
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user?.roles?.length) throw new ForbiddenException('No roles in token');

    const expandedRequired = requiredRoles.flatMap(r => [r, ...(ROLE_ALIASES[r] ?? [])]);
    if (!expandedRequired.some(r => user.roles.includes(r))) {
      throw new ForbiddenException('Insufficient role for this operation');
    }
    return true;
  }
}
