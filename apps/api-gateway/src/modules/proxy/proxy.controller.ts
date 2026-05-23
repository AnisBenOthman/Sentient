import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All(['api/hr', 'api/hr/*', 'api/social', 'api/social/*', 'api/ai', 'api/ai/*', 'api/*'])
  proxy(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.proxyService.forward(request, response);
  }
}

