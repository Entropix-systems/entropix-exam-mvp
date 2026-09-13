import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type {
  CallHandler,
  ExceptionFilter,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { API_ERROR_CODES } from '@entropix/contracts';
import type { ApiError, ApiErrorCode, ApiSuccess } from '@entropix/contracts';
import { AuthApplicationError } from '../application/auth.errors.js';
import { requestIdFor } from './request-context.js';

@Injectable()
export class ApiEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiSuccess<T>>
{
  intercept(
    execution: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T>> {
    const request = execution.switchToHttp().getRequest<Request>();
    return next
      .handle()
      .pipe(map((data) => ({ data, requestId: requestIdFor(request) })));
  }
}

function codeFor(status: number): ApiErrorCode {
  if (status === 401) return API_ERROR_CODES.UNAUTHENTICATED;
  if (status === 403) return API_ERROR_CODES.FORBIDDEN;
  if (status === 404) return API_ERROR_CODES.NOT_FOUND;
  if (status === 409) return API_ERROR_CODES.VERSION_CONFLICT;
  return API_ERROR_CODES.VALIDATION_ERROR;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let status = 500;
    let code: ApiErrorCode = API_ERROR_CODES.INTERNAL_ERROR;
    let message = 'Request failed';
    let fieldErrors: ApiError['fieldErrors'] = [];

    if (exception instanceof AuthApplicationError) {
      status = exception.kind === 'UNAUTHENTICATED' ? 401 : 422;
      code = codeFor(status);
      message = exception.message;
      if (exception.field)
        fieldErrors = [
          {
            field: exception.field,
            code: 'INVALID',
            message: exception.message,
          },
        ];
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeFor(status);
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' &&
              body !== null &&
              typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : status >= 500
              ? 'Request failed'
              : exception.message;
    }

    const payload: ApiError = {
      code,
      message: status >= 500 ? 'Request failed' : message,
      fieldErrors,
      requestId: requestIdFor(request),
    };
    response.status(status).json(payload);
  }
}
