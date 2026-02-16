import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private configService: ConfigService) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isAuthDisabled = this.configService.get<boolean>(
            'auth.disabled',
            false,
        );

        if (isAuthDisabled) {
            // Auth is disabled - inject mock user and skip JWT validation
            const request = context.switchToHttp().getRequest();
            request.user = {
                id: 'dev-user-id',
                email: 'dev@probodyline.com',
                name: 'Development User',
                role: 'ADMIN',
                isActive: true,
            };
            return true;
        }

        return super.canActivate(context);
    }
}
