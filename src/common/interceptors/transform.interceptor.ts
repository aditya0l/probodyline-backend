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
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const { query } = request;

    return next.handle().pipe(
      map((data) => {
        // If data already has a standardized format, return as is
        if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
          // Paginated response
          const page = query.page ? Number(query.page) : 0;
          const limit = query.limit ? Number(query.limit) : 50;
          const total = data.total;
          const totalPages = Math.ceil(total / limit);

          return {
            success: true,
            data: data.data,
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
          data,
        };
      }),
    );
  }
}

