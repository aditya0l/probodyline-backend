import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.url.includes('/api/auth/login') || request.url.includes('/api/auth/register') || request.url.includes('/api/auth/verify')) {
      return true;
    }

    return super.canActivate(context);
  }
}
