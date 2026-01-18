import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  /**
   * Recursively converts Prisma Decimal objects to plain numbers.
   * Handles nested objects, arrays, and preserves null/undefined values.
   */
  private serializeDecimals(value: any): any {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Check if value is a Prisma Decimal object (has toNumber method)
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof value.toNumber === 'function'
    ) {
      return value.toNumber();
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeDecimals(item));
    }

    // Handle Date objects (convert to ISO string)
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle plain objects
    if (typeof value === 'object' && value !== null) {
      const serialized: any = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          serialized[key] = this.serializeDecimals(value[key]);
        }
      }
      return serialized;
    }

    // Return primitive values as-is
    return value;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const { query } = request;

    return next.handle().pipe(
      map((data) => {
        // If data already has a standardized format, return as is
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'total' in data
        ) {
          // Paginated response
          const page = query.page ? Number(query.page) : 0;
          const limit = query.limit ? Number(query.limit) : 50;
          const total = data.total;
          const totalPages = Math.ceil(total / limit);

          return {
            success: true,
            data: this.serializeDecimals(data.data),
            meta: {
              page,
              limit,
              total,
              totalPages,
            },
          };
        }

        // Simple response
        return {
          success: true,
          data: this.serializeDecimals(data),
        };
      }),
    );
  }
}
