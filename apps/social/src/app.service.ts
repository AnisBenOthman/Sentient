import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: 'ok'; service: 'social'; timestamp: string } {
    return {
      status: 'ok',
      service: 'social',
      timestamp: new Date().toISOString(),
    };
  }
}
