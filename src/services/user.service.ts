import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
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
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
    private readonly apsService: APSService
  ) {}

  //** Create user. Only to be called by the system, not a user. */
  async createUser(
    rcno: number,
    userId: string,
    fullName: string,
    email: string,
    roles?: RoleEnum[]
  ): Promise<User> {
    if (!roles) roles = [];
    return await this.prisma.user.create({
      data: {
        rcno,
        userId,
        fullName,
        email,
        roles: { create: roles.map((role) => ({ role })) },
      },
    });
  }

  //** Get roles of user. First checks cache. If not in cache, gets from db and adds to cache */
  async getUserRolesList(id: number): Promise<Role[]> {
    let roles = await this.redisCacheService.get(`roles-${id}`);
    if (!roles) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: id },
      });
      roles = userRoles.map((r) => r.role);
      await this.redisCacheService.setForMonth(`roles-${id}`, roles);
    }
    return roles;
  }

  async userHasRole(userId: number, roles: Role[]): Promise<boolean> {
    const userRoles = await this.getUserRolesList(userId);
    if (roles.some((r) => userRoles.includes(r))) return true;
    return false;
  }

  async isAdminOrAgent(userId: number): Promise<boolean> {
    return await this.userHasRole(userId, ['Admin', 'Agent']);
  }

  async isAdmin(userId: number): Promise<boolean> {
    return await this.userHasRole(userId, ['Admin']);
  }

  async isAgent(userId: number): Promise<boolean> {
    return await this.userHasRole(userId, ['Agent']);
  }

  //** Create user group. */
  async createUserGroup(user: User, name: string, mode: string) {
    try {
      await this.prisma.userGroup.create({
        data: { name, mode, createdById: user.id },
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
    const [user, _] = await this.createIfNotExists(userId);
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
    args: UserGroupConnectionArgs
  ): Promise<PaginatedUserGroup> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { name } = args;
    const where: any = {
      AND: [{ name: { contains: name ?? '', mode: 'insensitive' } }],
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
    query: string
  ): Promise<SearchResult[]> {
    const contains = query.trim();
    let searchResults: SearchResult[] = [];
    let users = await this.apsService.searchAPS(contains);

    const where: any = {
      AND: [{ name: { contains, mode: 'insensitive' } }],
    };
    // Only these roles can see all user groups
    const isAdminOrAgent = await this.isAdminOrAgent(user.id);
    if (!isAdminOrAgent) {
      // Otherwise show only public groups
      where.AND.push({
        mode: 'Public',
      });
    }
    const userGroups = await this.prisma.userGroup.findMany({
      where,
      take: 5,
    });

    // Map each user group to search results
    userGroups.forEach((group) => {
      const searchResult = new SearchResult();
      searchResult.name = group.name;
      searchResult.type = 'UserGroup';
      searchResult.userGroup = group;
      searchResults.push(searchResult);
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

  async addAppUser(userId: string, roles: RoleEnum[]) {
    let user = await this.prisma.user.findFirst({
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
        roles
      );
      return;
    }

    // If user does exist, remove existing roles and add new roles.
    await this.prisma.userRole.deleteMany({ where: { userId: user.id } });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, role })),
    });
    await this.redisCacheService.del(`user-uuid-${userId}`);
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
