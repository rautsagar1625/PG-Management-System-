import * as Sentry from '@sentry/node';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ZodError } from 'zod';

import type { ApiResponse } from '@pg-system/types';

// Minimal shape we actually use — avoids importing 'fastify' directly
interface FReply { status(code: number): this; send(body: unknown): void }
interface FRequest { method: string; url: string; id?: string; user?: { userId?: string } }

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FReply>();
    const request = ctx.getRequest<FRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object') {
        const resp = response as Record<string, unknown>;
        message = (resp['message'] as string) || message;
        code = (resp['error'] as string) || `HTTP_${status}`;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = { issues: exception.errors };
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack, `${request.method} ${request.url}`);

      // Capture unhandled errors in Sentry with request context
      Sentry.withScope((scope) => {
        scope.setTag('requestId', request.id ?? 'unknown');
        scope.setTag('method', request.method);
        scope.setTag('url', request.url);
        if (request.user?.userId) {
          scope.setUser({ id: request.user.userId });
        }
        Sentry.captureException(exception);
      });
    }

    const body: ApiResponse = {
      success: false,
      error: { code, message, details },
    };

    reply.status(status).send(body);
  }
}
