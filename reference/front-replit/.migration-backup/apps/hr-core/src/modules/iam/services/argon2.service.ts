import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2Service {
  private readonly memoryCost: number;
  private readonly timeCost: number;
  private readonly parallelism: number;

  constructor(private readonly config: ConfigService) {
    const fast = config.get<string>('TEST_ARGON2_FAST') === 'true';
    this.memoryCost = fast ? 4096 : (config.get<number>('ARGON2_MEMORY_COST') ?? 65536);
    this.timeCost = fast ? 1 : (config.get<number>('ARGON2_TIME_COST') ?? 3);
    this.parallelism = config.get<number>('ARGON2_PARALLELISM') ?? 1;
  }

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
