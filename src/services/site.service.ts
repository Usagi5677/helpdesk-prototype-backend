import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import { Site } from 'src/models/site.model';
import { RoleEnum } from 'src/common/enums/roles';
@Injectable()
export class SiteService {
  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  async hasSiteAccess(
    userId: number,
    siteId: number,
    user?: User,
    site?: Site
  ): Promise<boolean> {
    let hasAccess = (await this.redisCacheService.get(
      `hasSiteAccess-${userId}-${siteId}`
    )) as boolean;
    if (hasAccess === null) {
      if (!user) {
        user = await this.prisma.user.findFirst({ where: { id: userId } });
      }
      if (user.isSuperAdmin) hasAccess = true;
      else {
        if (!site) {
          site = await this.prisma.site.findFirst({ where: { id: siteId } });
        }
        if (site.mode === 'Public') hasAccess = true;
        else {
          const siteRoleCount = await this.prisma.userRole.count({
            where: { userId, siteId },
          });
          if (siteRoleCount > 0) hasAccess = true;
          else hasAccess = false;
        }
      }
      await this.redisCacheService.setForMonth(
        `hasSiteAccess-${userId}-${siteId}`,
        hasAccess
      );
    }
    return hasAccess;
  }

  async checkSiteAccess(
    userId: number,
    siteId: number,
    user?: User,
    site?: Site
  ) {
    const hasSiteAccess = await this.hasSiteAccess(userId, siteId, user, site);
    if (!hasSiteAccess) {
      throw new UnauthorizedException('You do not have access to this site.');
    }
  }

  async getUserSites(userId: number, user?: User): Promise<Site[]> {
    const key = `userSites-${userId}`;
    let sites = (await this.redisCacheService.get(key)) as Site[];
    if (!sites) {
      if (!user) {
        user = await this.prisma.user.findFirst({ where: { id: userId } });
      }
      const allSites = await this.prisma.site.findMany({
        orderBy: { id: 'asc' },
      });
      if (user.isSuperAdmin) {
        sites = allSites;
      } else {
        const publicSites = [];
        const remainingSites = [];
        allSites.forEach((site) => {
          if (site.mode === 'Public') publicSites.push(site);
          else remainingSites.push(site);
        });
        const remainingSiteRoles = await this.prisma.userRole.findMany({
          where: {
            userId,
            siteId: { in: remainingSites.map((site) => site.id) },
          },
          orderBy: { id: 'asc' },
        });
        const remainingSiteRolesSiteIds = [
          ...new Set(remainingSiteRoles.map((role) => role.siteId)),
        ];
        const sitesWithRoles = remainingSites.filter((site) =>
          remainingSiteRolesSiteIds.includes(site.id)
        );
        sites = [...publicSites, ...sitesWithRoles];
      }
      await this.redisCacheService.setForMonth(key, sites);
    }
    return sites;
  }

  async sitesWithRoles(
    userId: number,
    roles: RoleEnum[],
    user?: User
  ): Promise<number[]> {
    if (!user) {
      user = await this.prisma.user.findFirst({ where: { id: userId } });
    }
    let siteIds = [];
    if (user.isSuperAdmin) {
      const sites = await this.prisma.site.findMany({ select: { id: true } });
      siteIds = sites.map((site) => site.id);
    } else {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          userId,
          role: { in: roles },
        },
      });
      siteIds = [...new Set(userRoles.map((ur) => ur.siteId))];
    }
    return siteIds;
  }

  async invalidateSitesCache() {
    await this.redisCacheService.delPattern('userSites-*');
  }

  async createSite(name: string, code: string, mode: string) {
    if (!['Public', 'Private'].includes(mode)) {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.site.create({
        data: {
          name,
          code,
          mode,
        },
      });
      await this.invalidateSitesCache();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(`A site with the code already exists.`);
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  async editSite(id: number, name: string, code: string, mode: string) {
    if (!['Public', 'Private'].includes(mode)) {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.site.update({
        where: { id },
        data: {
          name,
          code,
          mode,
        },
      });
      await this.invalidateSitesCache();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(`A site with the code already exists.`);
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  async deleteSite(id: number) {
    try {
      await this.prisma.site.delete({
        where: { id },
      });
      await this.invalidateSitesCache();
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }
}
