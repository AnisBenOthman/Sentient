import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { GatewayExceptionFilter } from './common/errors/gateway-exception.filter';
import type { GatewayConfig } from './config/route-config.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const gateway = configService.getOrThrow<GatewayConfig>('gateway');
  app.getHttpAdapter().getInstance().set('trust proxy', gateway.trustProxy);

  app.use(helmet());
  app.use(morgan('dev'));
  app.enableCors({
    origin: gateway.corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GatewayExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sentient API Gateway')
    .setDescription('Public gateway entry point for Sentient HRIS')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/gateway-docs', app, document);

  await app.listen(gateway.port);
  Logger.log(`API Gateway running on http://localhost:${gateway.port}`, 'Bootstrap');
}

bootstrap();
