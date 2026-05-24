import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // WHY: Prisma v7 switched the default engine to the TypeScript-native
    // "client" engine, which requires a driver adapter — the binary engine
    // is no longer the default. PrismaPg reads HR_CORE_DATABASE_URL from
    // the environment, matching what prisma.config.ts provides for migrations.
    const adapter = new PrismaPg({ connectionString: process.env["HR_CORE_DATABASE_URL"] });
    super({ adapter, errorFormat: "colorless" });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
