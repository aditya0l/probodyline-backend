import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) return false;

    // Admin has access to everything
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const path = request.url;
    const method = request.method;

    // --- Hardcoded Restrictions based on requirements ---

    // Yash (Sales)
    // Data Fetch Scope: Can view data of all users under him in the sales hierarchy
    // Accessible Modules: Everything except Purchase Order
    if (user.role === UserRole.SALES) {
      if (path.includes('/api/purchase-orders')) {
        return false; // Block Purchase Orders
      }
    }

    // Sanjay - HOD (Technical)
    // Data Fetch Scope: Can view data of all users under him
    // Accessible Module: Service Card only (All other modules Blocked at API level)
    // Exception: Read-only access to Sales Orders (only for Attach Sales Order flow)
    if (user.role === UserRole.HOD_TECHNICAL) {
      const isServiceCard = path.includes('/api/service-cards');
      const isSalesOrderRead = path.includes('/api/sales-orders') && method === 'GET';
      const isAuth = path.includes('/api/auth');
      
      if (!isServiceCard && !isSalesOrderRead && !isAuth) {
        return false; // Block everything else
      }
    }

    if (!requiredRoles) {
      return true;
    }

    return requiredRoles.some((role) => user.role === role);
  }
}
