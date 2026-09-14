import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { TimeoutInterceptor } from './common/interceptors';

async function bootstrap(): Promise<void> {
  // WHY rawBody: Slack signs the exact bytes it sent (X-Slack-Signature over
  // v0:<ts>:<body>); a re-serialised JSON body would never verify. Nest keeps
  // the buffer on req.rawBody alongside the parsed body — see SlackController.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(morgan('dev'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor(configService));

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Agentic API')
    .setDescription('Sentient HRIS — AI Agentic microservice')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('AI_AGENT_PORT', 3003);
  await app.listen(port);
}

bootstrap();
