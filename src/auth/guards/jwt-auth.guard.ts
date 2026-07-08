import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (
      request.url.includes('/api/auth/login') || 
      request.url.includes('/api/auth/register') || 
      request.url.includes('/api/auth/verify') ||
      request.url.includes('/api/files') ||
      (request.url.includes('/api/pdf') && request.method === 'GET')
    ) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    if (context) {
      console.log('JWT GUARD HEADERS:', context.switchToHttp().getRequest().headers);
    }
    if (err || !user) {
      console.error('JwtAuthGuard failed:', { err, info: info?.message || info, user: !!user });
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
