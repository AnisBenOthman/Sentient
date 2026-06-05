import { Injectable } from '@nestjs/common';
import { AiHealthResponse, AiHealthService } from './modules/agents';

@Injectable()
export class AppService {
  constructor(private readonly aiHealth: AiHealthService) {}

  getHealth(): AiHealthResponse {
    return this.aiHealth.getHealth();
  }
}
