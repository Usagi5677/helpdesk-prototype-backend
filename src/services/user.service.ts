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
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  //** Create user. Only to be called by the system, not a user. */
  async createUser(
    rcno: number,
    userId: string,
    fullName: string
  ): Promise<User> {
    return await this.prisma.user.create({ data: { rcno, userId, fullName } });
  }

  //** Get roles of user. First checks cache. If not in cache, gets from db and adds to cache */
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

  async userHasRole(user: User, roles: Role[]): Promise<boolean> {
    const userRoles = await this.getUserRolesList(user.id);
    console.log(roles);
    console.log(userRoles);
    if (roles.some((r) => userRoles.includes(r))) return true;
    return false;
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
  async changeUserGroupName(id: number, name: string) {
    try {
      await this.prisma.userGroup.update({
        data: { name },
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

  //** Change mode of user group. */
  async changeUserGroupMode(id: number, mode: string) {
    if (mode !== 'Private' && mode !== 'Public') {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.userGroup.update({
        data: { mode },
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
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
  async addToUserGroup(userId: number, userGroupId: number) {
    try {
      await this.prisma.userGroupUser.create({
        data: { userId, userGroupId },
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
  async removeFromUserGroup(id: number) {
    try {
      await this.prisma.userGroupUser.delete({
        where: { id },
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
    console.log(userGroupResp);
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
    const { name } = args;
    let conditionalMode = { mode: 'Public' };

    // Only these roles can see all results
    const showAllToRoles: Role[] = ['Admin', 'Agent'];
    if (await this.userHasRole(user, showAllToRoles)) {
      conditionalMode = null;
    }
    const where: any = {
      AND: [
        { name: { contains: name ?? '', mode: 'insensitive' } },
        conditionalMode,
      ],
    };
    const userGroups = await this.prisma.userGroup.findMany({
      skip: offset,
      take: limitPlusOne,
      where,
    });
    const count = await this.prisma.userGroup.count({ where });
    const { edges, pageInfo } = connectionFromArraySlice(
      userGroups.slice(0, limit),
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
    let take = 3;
    const contains = query.trim();
    const isRCNO = /^-?\d+$/.test(contains);
    let searchResults: SearchResult[] = [];
    let users: User[] = [];

    // If search query is just a number, search user rcno only
    if (isRCNO) {
      users = await this.prisma.user.findMany({
        where: { rcno: parseInt(contains) },
        take,
      });
    }

    // Otherwise search both users and user groups by name
    else {
      // Only these roles can see all user groups
      const where: any = {
        AND: [{ name: { contains, mode: 'insensitive' } }],
      };
      const visibleRoles: Role[] = ['Admin', 'Agent'];
      const canSeePrivateGroups = await this.userHasRole(user, visibleRoles);
      if (!canSeePrivateGroups) {
        where.AND.push({
          mode: 'Public',
        });
      }
      const userGroups = await this.prisma.userGroup.findMany({
        where,
        take: Math.ceil(take / 2),
      });
      userGroups.forEach((group) => {
        const searchResult = new SearchResult();
        searchResult.name = group.name;
        searchResult.type = 'UserGroup';
        searchResult.userGroup = group;
        searchResults.push(searchResult);
      });

      if (userGroups.length < take / 2) take = take - userGroups.length;
      users = await this.prisma.user.findMany({
        where: { fullName: { contains, mode: 'insensitive' } },
        take: take,
      });
    }
    users.forEach((user) => {
      const searchResult = new SearchResult();
      searchResult.name = user.fullName;
      searchResult.type = 'User';
      searchResult.user = user;
      searchResults.push(searchResult);
    });
    return searchResults;
  }
}
