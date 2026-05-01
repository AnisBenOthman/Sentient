import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    }

    const rawResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof rawResponse === 'string'
        ? rawResponse
        : ((rawResponse as Record<string, unknown>)['message'] as string) ??
          'Internal server error';

    res.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'Unknown',
      correlationId: ((req as unknown as Record<string, unknown>)['correlationId'] as string | undefined) ?? 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
}
