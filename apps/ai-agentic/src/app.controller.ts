import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@sentient/shared';
import { AppService } from './app.service';
import { AiHealthResponse } from './modules/agents';

@Controller()
@ApiTags('Health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Service health check' })
  @ApiOkResponse({ description: 'Supervisor and specialist health roster' })
  getHealth(): AiHealthResponse {
    return this.appService.getHealth();
  }
}
