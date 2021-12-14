import { PrismaService } from 'nestjs-prisma';
import { Injectable } from '@nestjs/common';
import { User, Role } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService
  ) {}
  async createUser(
    rcno: number,
    userId: string,
    fullName: string
  ): Promise<User> {
    return await this.prisma.user.create({ data: { rcno, userId, fullName } });
  }

  async getUserRolesList(id: number): Promise<Role[]> {
    let roles = await this.redisCacheService.get(`roles-${id}`);
    if (!roles) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: id },
      });
      roles = userRoles.map((r) => r.role);
      const secondsInMonth = 30 * 24 * 60 * 60;
      await this.redisCacheService.set(`roles-${id}`, roles, secondsInMonth);
    }
    return roles;
  }
}
