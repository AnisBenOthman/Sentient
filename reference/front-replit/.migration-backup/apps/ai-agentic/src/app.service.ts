import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'ai-agentic',
      timestamp: new Date().toISOString(),
    };
  }
}
