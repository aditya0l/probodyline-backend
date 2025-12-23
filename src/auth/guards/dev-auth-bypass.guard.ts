import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Development Auth Bypass Guard
 * 
 * When DISABLE_AUTH=true, this guard injects a mock user with the seeded organization ID.
 * This allows development to proceed without authentication while keeping auth code intact.
 * 
 * To re-enable auth: Set DISABLE_AUTH=false in .env
 */
@Injectable()
export class DevAuthBypassGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isAuthDisabled = this.configService.get<boolean>('auth.disabled', false);

    if (!isAuthDisabled) {
      // Auth is enabled, let other guards handle it
      return true;
    }

    // Auth is disabled - inject mock user
    const request = context.switchToHttp().getRequest();
    
    // Inject mock user (no organizationId needed for single-tenant)
    request.user = {
      id: 'dev-user-id',
      email: 'dev@probodyline.com',
      name: 'Development User',
      role: 'ADMIN',
      isActive: true,
    };

    return true;
  }
}

