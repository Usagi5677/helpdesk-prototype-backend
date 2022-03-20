import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { User, Role, UserGroup, Prisma } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import { UserGroupConnectionArgs } from 'src/models/args/user-group-connection.args';
import {
  connectionFromArraySlice,
  getPagingParameters,
} from 'src/common/pagination/connection-args';
import { PaginatedUserGroup } from 'src/models/pagination/user-group-connection.model';
import { SearchResult } from 'src/models/search-result.model';
import { APSService } from './aps.service';
import { RoleEnum } from 'src/common/enums/roles';
import { UserGroup as UserGroupModel } from 'src/models/user-group.model';
import { Profile } from 'src/models/profile.model';
import { UserRole } from 'src/models/user-role.model';
import { SiteService } from './site.service';
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
    private readonly apsService: APSService,
    private readonly siteService: SiteService
  ) {}

  //** Create user. Only to be called by the system, not a user. */
  async createUser(
    rcno: number,
    userId: string,
    fullName: string,
    email: string,
    roles?: RoleEnum[],
    siteId?: number
  ): Promise<User> {
    if (!roles) roles = [];
    return await this.prisma.user.create({
      data: {
        rcno,
        userId,
        fullName,
        email,
        roles: { create: roles.map((role) => ({ role, siteId })) },
      },
    });
  }

  //** Get roles of user. First checks cache. If not in cache, gets from db and adds to cache */
  async getUserRoles(id: number): Promise<UserRole[]> {
    let roles = await this.redisCacheService.get(`roles-${id}`);
    if (!roles) {
      roles = await this.prisma.userRole.findMany({
        where: { userId: id },
        include: { site: true },
      });
      await this.redisCacheService.setForMonth(`roles-${id}`, roles);
    }
    return roles;
  }

  //** Get roles of user. First checks cache. If not in cache, gets from db and adds to cache */
  async getUserSiteRoles(id: number, siteId: number): Promise<string[]> {
    let roles = await this.redisCacheService.get(`roles-${id}`);
    if (!roles) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: id, siteId },
      });
      roles = userRoles.map((r) => r.role);
      await this.redisCacheService.setForMonth(`roles-${id}`, roles);
    }
    return roles;
  }

  async userHasRole(
    userId: number,
    roles: Role[],
    siteId: number
  ): Promise<boolean> {
    const userRoles = await this.getUserSiteRoles(userId, siteId);
    if (roles.some((r) => userRoles.includes(r))) return true;
    return false;
  }

  async isAdminOrAgent(userId: number, siteId: number): Promise<boolean> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (user.isSuperAdmin) return true;
    return await this.userHasRole(userId, ['Admin', 'Agent'], siteId);
  }

  async isAdmin(userId: number, siteId: number): Promise<boolean> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (user.isSuperAdmin) return true;
    return await this.userHasRole(userId, ['Admin'], siteId);
  }

  async isAgent(userId: number, siteId: number): Promise<boolean> {
    return await this.userHasRole(userId, ['Agent'], siteId);
  }

  async checkAdminOrAgent(userId: number, siteId: number) {
    const isAdminOrAgent = await this.isAdminOrAgent(userId, siteId);
    if (!isAdminOrAgent) {
      throw new UnauthorizedException('You do not have access to this site.');
    }
  }
  async checkAdmin(userId: number, siteId: number) {
    const isAdmin = await this.isAdmin(userId, siteId);
    if (!isAdmin) {
      throw new UnauthorizedException('You do not have access to this site.');
    }
  }
  async checkAgent(userId: number, siteId: number) {
    const isAgent = await this.isAgent(userId, siteId);
    if (!isAgent) {
      throw new UnauthorizedException('You do not have access to this site.');
    }
  }

  //** Create user group. */
  async createUserGroup(
    user: User,
    name: string,
    mode: string,
    siteId: number
  ) {
    try {
      await this.prisma.userGroup.create({
        data: { name, mode, createdById: user.id, siteId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(`User group ${name} already exists.`);
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  //** Change name of user group. */
  async editUserGroup(id: number, name: string, mode: string) {
    if (mode !== 'Private' && mode !== 'Public') {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.userGroup.update({
        data: { name, mode },
        where: { id },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(`User group ${name} already exists.`);
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  //** Delete user group. */
  async deleteUserGroup(id: number) {
    try {
      await this.prisma.userGroup.delete({
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Add user to user group. */
  async addToUserGroup(userId: string, userGroupId: number) {
    const [user] = await this.createIfNotExists(userId);
    try {
      await this.prisma.userGroupUser.create({
        data: { userId: user.id, userGroupId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(`User is already in user group.`);
      } else {
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  //** Remove user from user group. */
  async removeFromUserGroup(userId: number, userGroupId: number) {
    try {
      await this.prisma.userGroupUser.deleteMany({
        where: { userId, userGroupId },
      });
    } catch (e) {
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Get user group by id. Returns users in the user group as well. */
  async getUserGroup(id: number): Promise<[UserGroup, User[]]> {
    const userGroupResp = await this.prisma.userGroup.findFirst({
      where: { id },
      include: { userGroupUsers: { include: { user: true } } },
    });
    if (!userGroupResp) {
      throw new BadRequestException('User group does not exist.');
    }
    return [userGroupResp, userGroupResp.userGroupUsers.map((ugu) => ugu.user)];
  }

  //** Get user groups. Results are paginated. User cursor argument to go forward/backward. */
  async getUserGroupsWithPagination(
    user: User,
    args: UserGroupConnectionArgs
  ): Promise<PaginatedUserGroup> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { name, siteId } = args;
    await this.checkAdminOrAgent(user.id, siteId);
    const where: any = {
      AND: [
        { name: { contains: name ?? '', mode: 'insensitive' } },
        { siteId },
      ],
    };
    const userGroups = await this.prisma.userGroup.findMany({
      skip: offset,
      take: limitPlusOne,
      where,
      include: { userGroupUsers: { include: { user: true } } },
    });
    const userGroupsResp: UserGroupModel[] = [];
    userGroups.forEach((userGroup) => {
      const userGroupResp = new UserGroupModel();
      Object.assign(userGroupResp, userGroup);
      userGroupResp.users = userGroup.userGroupUsers.map((ugu) => ugu.user);
      userGroupsResp.push(userGroupResp);
    });
    const count = await this.prisma.userGroup.count({ where });
    const { edges, pageInfo } = connectionFromArraySlice(
      userGroupsResp.slice(0, limit),
      args,
      {
        arrayLength: count,
        sliceStart: offset,
      }
    );
    return {
      edges,
      pageInfo: {
        ...pageInfo,
        count,
        hasNextPage: offset + limit < count,
        hasPreviousPage: offset >= limit,
      },
    };
  }

  //** Searches users and user groups */
  async searchUserAndGroups(
    user: User,
    query: string,
    onlyAgents?: boolean
  ): Promise<SearchResult[]> {
    const contains = query.trim();
    const searchResults: SearchResult[] = [];
    let users: User[] = [];
    if (onlyAgents) {
      users = await this.prisma.user.findMany({
        where: {
          fullName: { contains, mode: 'insensitive' },
          roles: { some: { role: { in: ['Agent'] } } },
        },
      });
    } else {
      users = await this.apsService.searchAPS(contains);
    }

    const sitesWithAccess = await this.siteService.getUserSites(user.id, user);
    const sitesWithAccessIds = sitesWithAccess.map((site) => site.id);

    const where: any = {
      AND: [
        { name: { contains, mode: 'insensitive' } },
        { siteId: { in: sitesWithAccessIds } },
      ],
    };
    if (onlyAgents)
      where.AND.push({
        userGroupUsers: {
          every: { user: { roles: { some: { role: 'Agent' } } } },
        },
      });
    const userGroups = await this.prisma.userGroup.findMany({
      where,
      take: 5,
      include: { userGroupUsers: { include: { user: true } } },
    });

    // Map each user group to search results
    userGroups.forEach((group) => {
      if (group.userGroupUsers.length > 0) {
        const searchResult = new SearchResult();
        searchResult.name = group.name;
        searchResult.type = 'UserGroup';
        searchResult.userGroup = group;
        searchResult.userGroup.users = group.userGroupUsers.map(
          (ugu) => ugu.user
        );
        searchResults.push(searchResult);
      }
    });

    // Map each user to search results
    users.forEach((user) => {
      const searchResult = new SearchResult();
      searchResult.name = user.fullName;
      searchResult.type = 'User';
      searchResult.user = user;
      searchResults.push(searchResult);
    });
    return searchResults;
  }

  async addAppUser(userId: string, roles: RoleEnum[], siteId) {
    const user = await this.prisma.user.findFirst({
      where: { userId },
      include: { roles: true },
    });

    // If user doesn't exist on the system, fetch from APS, then create user with roles.
    if (!user) {
      const profile = await this.apsService.getProfile(userId);
      if (!profile) {
        throw new BadRequestException('Invalid user.');
      }
      await this.createUser(
        profile.rcno,
        profile.userId,
        profile.fullName,
        profile.email,
        roles,
        siteId
      );
      return;
    }

    try {
      // If user does exist, remove existing roles and add new roles.
      await this.prisma.userRole.deleteMany({
        where: { userId: user.id, siteId },
      });
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: user.id, role, siteId })),
      });
    } catch (e) {
      console.log(e);
    }
    await this.redisCacheService.del(`user-uuid-${userId}`);
    await this.redisCacheService.del(`roles-${user.id}`);
  }

  async createIfNotExists(userId: string): Promise<[User, Profile]> {
    let user = await this.prisma.user.findFirst({
      where: { userId },
    });
    const profile = await this.apsService.getProfile(userId);
    if (!profile) {
      throw new BadRequestException('Invalid user.');
    }
    if (!user) {
      user = await this.createUser(
        profile.rcno,
        profile.userId,
        profile.fullName,
        profile.email
      );
    }
    return [user, profile];
  }
}
