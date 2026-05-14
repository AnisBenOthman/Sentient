import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../notifications.service';

const RETENTION_DAYS = 90;

@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron('0 3 * * *')
  async purgeExpiredNotifications(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const count = await this.notificationsService.purgeOlderThan(cutoff);
    this.logger.log(`Purged ${count} notifications older than ${RETENTION_DAYS} days`);
  }
}
