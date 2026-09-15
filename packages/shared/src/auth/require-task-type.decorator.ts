import { SetMetadata } from '@nestjs/common';

export const TASK_TYPE_KEY = 'systemTaskType';

/**
 * WHY: A SYSTEM JWT's `taskType` scopes it to one background task (security.md
 * §3) so a leaked token can't be replayed against unrelated SYSTEM-only
 * endpoints. `@Roles('SYSTEM')` alone only checks the role, not the task —
 * pair it with `@RequireTaskType(...)` + `SystemTaskGuard` wherever a
 * specific taskType must match.
 */
export const RequireTaskType = (taskType: string): MethodDecorator & ClassDecorator =>
  SetMetadata(TASK_TYPE_KEY, taskType);
