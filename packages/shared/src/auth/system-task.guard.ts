import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemJwtPayload } from './system-jwt-payload.interface';
import { TASK_TYPE_KEY } from './require-task-type.decorator';

/**
 * WHY: Enforces the taskType scoping documented on SystemJwtPayload. Must run
 * after SharedJwtGuard (which populates request.user) and alongside
 * @Roles('SYSTEM') — this guard only narrows an already-SYSTEM-authenticated
 * request down to the one taskType the endpoint expects.
 */
@Injectable()
export class SystemTaskGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTaskType = this.reflector.getAllAndOverride<string | undefined>(TASK_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredTaskType) return true;

    const request = context.switchToHttp().getRequest<{ user?: SystemJwtPayload }>();
    const user = request.user;
    if (!user || user.sub !== 'system') {
      throw new ForbiddenException('This endpoint requires a SYSTEM token');
    }
    if (user.taskType !== requiredTaskType) {
      throw new ForbiddenException(`SYSTEM token is scoped to '${user.taskType}', not '${requiredTaskType}'`);
    }
    return true;
  }
}
