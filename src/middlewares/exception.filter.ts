import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle Sequelize validation errors
    if (exception.name === 'SequelizeValidationError' || 
        exception.name === 'SequelizeUniqueConstraintError' ||
        exception.name === 'SequelizeDatabaseError') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
    }
    // Handle HttpExceptions
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message = typeof response === 'string' ? response : response['message'] || exception.message;
    }
    // Handle other errors
    else {
      message = exception.message || 'Internal server error';
    }

    response.status(status).json({
      success: false,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
    });
  }
}
