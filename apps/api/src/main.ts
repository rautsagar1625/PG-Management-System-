// Sentry MUST be initialised before any other imports that might throw
import './instrument';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: isProd ? 'info' : 'debug',
        ...(isProd
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              },
            }),
        serializers: {
          req(req: { method: string; url: string; id: string; ip: string }) {
            return { method: req.method, url: req.url, requestId: req.id, remoteAddress: req.ip };
          },
          res(res: { statusCode: number }) {
            return { statusCode: res.statusCode };
          },
        },
      },
      genReqId: () => crypto.randomUUID(),
    }),
  );

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PG Management System API')
      .setDescription('Production-grade PG Business Operating System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const rawCorsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const corsOrigins = rawCorsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  // Surface the internally-generated request ID to clients for correlation
  app.getHttpAdapter().getInstance().addHook(
    'onSend',
    (_req: { id: string }, reply: { header: (k: string, v: string) => void }, _payload: unknown, done: () => void) => {
      reply.header('X-Request-Id', _req.id);
      done();
    },
  );

  await app.listen(port, '0.0.0.0');
  Logger.log(`API running on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');

  if (!isProd) {
    Logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
  }
}

bootstrap();
