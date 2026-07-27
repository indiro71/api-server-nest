import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ErrorLogService } from './error-log.service';

@Catch()
export class ErrorLogExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorLogService: ErrorLogService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = exception instanceof HttpException
      ? exception.getResponse()
      : {
        message: 'Internal server error',
        statusCode: status,
      };

    void this.errorLogService.capture(exception, {
      context: {
        body: request?.body,
        params: request?.params,
        query: request?.query,
        response: responseBody,
      },
      level: status >= 500 ? 'error' : 'warn',
      method: request?.method,
      source: 'http',
      status,
      url: request?.originalUrl || request?.url,
      userId: request?.user?._id || request?.user?.id,
    });

    if (response?.headersSent) {
      return;
    }

    response.status(status).json(
      typeof responseBody === 'object'
        ? responseBody
        : {
          message: responseBody,
          statusCode: status,
        },
    );
  }
}
