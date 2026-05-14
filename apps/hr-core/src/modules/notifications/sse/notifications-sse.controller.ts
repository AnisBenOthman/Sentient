import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles } from '@sentient/shared';
import { interval, map, merge, Observable } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { NotificationsSseRegistry } from './notifications-sse.registry';
import { SseAuthGuard } from './sse-auth.guard';

@Controller('notifications')
@UseGuards(SseAuthGuard, RbacGuard)
@ApiTags('Notifications')
export class NotificationsSseController {
  constructor(private readonly registry: NotificationsSseRegistry) {}

  @Sse('stream')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN')
  stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    const keepAlive$ = interval(30_000).pipe(
      map((): MessageEvent => ({ type: 'keep-alive', data: { at: new Date().toISOString() } })),
    );
    return merge(this.registry.subscribe(user.sub), keepAlive$);
  }
}
