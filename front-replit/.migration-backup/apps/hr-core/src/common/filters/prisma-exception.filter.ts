import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { HttpExceptionFilter } from './http-exception.filter';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly httpFilter = new HttpExceptionFilter();

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    if (exception.code === 'P2002') {
      const fields = Array.isArray(exception.meta?.['target'])
        ? (exception.meta['target'] as string[]).join(', ')
        : 'field';
      this.httpFilter.catch(
        new ConflictException(`Unique constraint violation on: ${fields}`),
        host,
      );
      return;
    }

    if (exception.code === 'P2025') {
      this.httpFilter.catch(
        new NotFoundException(exception.meta?.['cause'] ?? 'Record not found'),
        host,
      );
      return;
    }

    this.httpFilter.catch(exception as unknown as Error, host);
  }
}
