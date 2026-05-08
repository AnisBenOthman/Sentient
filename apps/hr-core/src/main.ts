import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { HttpExceptionFilter, PrismaExceptionFilter } from './common/filters';
import { TimeoutInterceptor } from './common/interceptors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const configuredOrigins = configService
    .get<string>('FRONTEND_URL', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ]);

  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true;

    try {
      const url = new URL(origin);
      const isLoopback =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1' ||
        url.hostname === '[::1]';

      return allowedOrigins.has(origin) || isLoopback;
    } catch {
      return false;
    }
  };

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin, Access-Control-Request-Headers');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] ?? 'Authorization,Content-Type',
      );
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(HttpStatus.NO_CONTENT);
      return;
    }

    next();
  });

  app.enableCors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  });

  app.use(helmet());
  app.use(morgan('dev'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor(configService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR Core API')
    .setDescription('Sentient HRIS — HR Core microservice')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('HR_CORE_PORT', 3001);
  await app.listen(port);
}

bootstrap();
