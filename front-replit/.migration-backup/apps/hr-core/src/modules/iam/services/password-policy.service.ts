import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Argon2Service } from './argon2.service';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

@Injectable()
export class PasswordPolicyService {
  private readonly historyDepth: number;

  constructor(
    private readonly config: ConfigService,
    private readonly argon2: Argon2Service,
  ) {
    this.historyDepth = config.get<number>('PASSWORD_HISTORY_DEPTH') ?? 5;
  }

  validateComplexity(password: string): void {
    if (!PASSWORD_REGEX.test(password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and contain uppercase, lowercase, digit, and special character.',
      );
    }
  }

  async assertNotReused(plain: string, history: string[]): Promise<void> {
    const recent = history.slice(-this.historyDepth);
    for (const oldHash of recent) {
      if (await this.argon2.verify(oldHash, plain)) {
        throw new BadRequestException(
          `Password was used recently. Choose a password not used in the last ${this.historyDepth} changes.`,
        );
      }
    }
  }

  buildUpdatedHistory(currentHash: string, history: string[]): string[] {
    return [...history, currentHash].slice(-this.historyDepth);
  }
}
