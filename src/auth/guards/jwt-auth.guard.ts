import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// Public routes, matched on the request path only (query string stripped).
// A prefix matches the path itself or anything below it ("/api/files" matches
// "/api/files/x" but not "/api/filesx"). method: undefined means any method.
const PUBLIC_ROUTES: { prefix: string; method?: string }[] = [
  { prefix: '/api/auth/login' },
  { prefix: '/api/auth/register' },
  { prefix: '/api/auth/verify' },
  // Was public via the old substring match on '/api/auth/verify'; kept as-is.
  { prefix: '/api/auth/verify-otp' },
  // Shared file links (incl. /api/files/share-proxy) are opened without a token.
  { prefix: '/api/files', method: 'GET' },
  { prefix: '/api/pdf', method: 'GET' },
  { prefix: '/api/pdf/shorten' },
];

export function isPublicRoute(method: string, url: string): boolean {
  const path = (url || '').split('?')[0].split('#')[0].toLowerCase();
  const verb = (method || '').toUpperCase();
  return PUBLIC_ROUTES.some(
    (route) =>
      (!route.method || route.method === verb || (route.method === 'GET' && verb === 'HEAD')) &&
      (path === route.prefix || path.startsWith(route.prefix + '/')),
  );
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (isPublicRoute(request.method, request.originalUrl ?? request.url)) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    if (err || !user) {
      console.error('JwtAuthGuard failed:', { err, info: info?.message || info, user: !!user });
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
