import { PrismaService } from '../prisma.service';
import { UserRole } from '@prisma/client';

export class ScopeUtil {
  /**
   * Generates a Prisma where condition for scoping data access based on user role and hierarchy.
   *
   * @param currentUser The user making the request
   * @param prisma The PrismaService instance to query the hierarchy
   * @returns A Promise that resolves to an object which can be mixed into a Prisma `where` clause
   */
  static async getScopeCondition(
    currentUser: { id: string; role: string; managerId?: string },
    prisma: PrismaService,
  ): Promise<any> {
    // Admin sees everything
    if (currentUser.role === UserRole.ADMIN) {
      return {};
    }

    // For HOD_TECHNICAL or SALES (or managers in general), they see their own records + records of their team
    if (currentUser.role === UserRole.HOD_TECHNICAL || currentUser.role === UserRole.SALES) {
      // Find all users who report directly to this user (1 level deep)
      const teamMembers = await prisma.user.findMany({
        where: { managerId: currentUser.id },
        select: { id: true },
      });

      const teamIds = teamMembers.map((u) => u.id);
      
      // Include the current user's ID as well
      const allowedIds = [currentUser.id, ...teamIds];

      // Yash sees all legacy records (where createdBy is null)
      if (currentUser.role === UserRole.SALES) {
        return {
          OR: [
            { createdBy: { in: allowedIds } },
            { createdBy: null },
          ],
        };
      }

      // Sanjay sees only his new records and his team's
      return {
        createdBy: { in: allowedIds },
      };
    }

    // For STAFF or other roles, they only see their own records
    return {
      createdBy: currentUser.id,
    };
  }
}
