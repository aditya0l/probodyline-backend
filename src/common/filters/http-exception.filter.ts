import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

// Standardized error codes
export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest() as Request & { requestId?: string };

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | object = 'Internal Server Error';
    let errorCode = ErrorCode.INTERNAL_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Map HTTP status to error codes
      if (status === HttpStatus.NOT_FOUND) {
        errorCode = ErrorCode.NOT_FOUND;
      } else if (status === HttpStatus.BAD_REQUEST) {
        errorCode = ErrorCode.BAD_REQUEST;
      } else if (status === HttpStatus.UNAUTHORIZED) {
        errorCode = ErrorCode.UNAUTHORIZED;
      } else if (status === HttpStatus.FORBIDDEN) {
        errorCode = ErrorCode.FORBIDDEN;
      } else if (status === HttpStatus.CONFLICT) {
        errorCode = ErrorCode.CONFLICT;
      }
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = exceptionResponse;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors
      status = HttpStatus.BAD_REQUEST;
      switch (exception.code) {
        case 'P2002':
          errorCode = ErrorCode.UNIQUE_CONSTRAINT_VIOLATION;
          message = 'Unique constraint violation';
          error = `A record with this ${exception.meta?.target} already exists`;
          break;
        case 'P2025':
          errorCode = ErrorCode.NOT_FOUND;
          message = 'Record not found';
          error = 'The requested record does not exist';
          break;
        case 'P2003':
          errorCode = ErrorCode.FOREIGN_KEY_VIOLATION;
          message = 'Foreign key constraint violation';
          error = 'Invalid reference to related record';
          break;
        default:
          errorCode = ErrorCode.DATABASE_ERROR;
          message = 'Database error';
          error = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      errorCode = ErrorCode.VALIDATION_ERROR;
      message = 'Validation error';
      error = 'Invalid data provided';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.message;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.requestId || 'N/A',
      message,
      error: typeof error === 'string' ? error : JSON.stringify(error),
    };

    // Log error for debugging
    console.error('Error:', {
      requestId: request.requestId,
      status,
      errorCode,
      message,
      error,
      path: request.url,
      method: request.method,
    });

    response.status(status).json(errorResponse);
  }
}

