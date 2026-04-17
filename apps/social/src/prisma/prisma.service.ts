import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * WHY: Schema has no models yet — the Prisma client cannot be generated
 * until at least one model is defined. This stub is replaced with the
 * real `extends PrismaClient` implementation when the first Social module
 * (Announcement, Event, etc.) is scaffolded and `prisma migrate dev` is run.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // Replaced with `await this.$connect()` once client is generated.
  }

  async onModuleDestroy(): Promise<void> {
    // Replaced with `await this.$disconnect()` once client is generated.
  }
}
