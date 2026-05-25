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

  // Surface the internally-generated request ID to clients for correlation.
  // SP5-4: Also emit X-Response-Time (ms) so APM tools and Nginx logs can track latency.
  // Fastify sets reply.elapsedTime internally (ms since request received) — no extra
  // onRequest hook needed.
  // Also override Helmet's strict CSP for the Razorpay payment checkout page, which
  // needs to load an external script (checkout.razorpay.com) and open frames.
  app.getHttpAdapter().getInstance().addHook(
    'onSend',
    (
      _req: { id: string; url?: string },
      reply: { header: (k: string, v: string) => void; removeHeader: (k: string) => void; elapsedTime: number },
      _payload: unknown,
      done: () => void,
    ) => {
      reply.header('X-Request-Id', _req.id);
      reply.header('X-Response-Time', `${reply.elapsedTime.toFixed(2)}ms`);

      // Relax CSP only for the Razorpay checkout HTML page.
      if (_req.url?.includes('/tenant/pay/checkout')) {
        reply.removeHeader('Content-Security-Policy');
        reply.header(
          'Content-Security-Policy',
          [
            "default-src 'self' https:",
            "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com",
            "frame-src https://api.razorpay.com https://checkout.razorpay.com",
            "frame-ancestors 'none'",
          ].join('; '),
        );
        // Disable COEP for this route — Razorpay loads cross-origin resources
        reply.removeHeader('Cross-Origin-Embedder-Policy');
        reply.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
      }

      done();
    },
  );

  // SP4-5: Graceful shutdown — drain BullMQ workers before exit.
  // `enableShutdownHooks` listens for SIGTERM/SIGINT and calls the
  // `OnApplicationShutdown` lifecycle hook. `@nestjs/bullmq` uses that
  // hook to call `worker.close()` which lets in-progress jobs finish
  // before the process exits. The manual handler adds a hard timeout so
  // the container (ECS / k8s) can always reclaim the pod in finite time.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API running on http://localhost:${port}/${apiPrefix}`);

  if (!isProd) {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  }

  const SHUTDOWN_TIMEOUT_MS = 15_000; // 15 s — enough for in-flight BullMQ jobs

  process.on('SIGTERM', () => {
    logger.log('SIGTERM received — starting graceful shutdown');

    // Hard-kill timer so we never hang inside a container scheduler.
    const killTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 15 s — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killTimer.unref(); // don't let this timer keep the event loop alive

    app
      .close()
      .then(() => {
        logger.log('Application shutdown complete');
        process.exit(0);
      })
      .catch((err: Error) => {
        logger.error(`Error during shutdown: ${err.message}`);
        process.exit(1);
      });
  });
}

bootstrap();
