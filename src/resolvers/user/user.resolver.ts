import { ExecutionContext, UseGuards } from '@nestjs/common';
import {
  Args,
  GqlExecutionContext,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { User } from '../../models/user.model';
import { PrismaService } from 'nestjs-prisma';
import { UsersConnectionArgs } from '../../models/args/user-connection.args';
import { PaginatedUsers } from '../../models/pagination/user-connection.model';
import {
  connectionFromArraySlice,
  getPagingParameters,
} from '../../common/pagination/connection-args';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { Profile } from 'src/models/profile.model';
import { APSService } from 'src/services/aps.service';
import { UserWithRoles } from 'src/models/user-with-roles.model';
import { Role } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import { RoleEnum } from 'src/common/enums/roles';

@Resolver(() => User)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserResolver {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private apsService: APSService,
    private redisCacheService: RedisCacheService
  ) {}

  @Query(() => UserWithRoles)
  async me(@UserEntity() user: User): Promise<UserWithRoles> {
    const userWithRoles = new UserWithRoles();
    Object.assign(userWithRoles, user);
    userWithRoles.roles = await this.userService.getUserRolesList(user.id);
    return userWithRoles;
  }

  @Query(() => Profile)
  async profile(@UserEntity() user: User): Promise<Profile> {
    return this.apsService.getProfile(user.userId);
  }

  /** Search APS users. */
  @Query(() => [User])
  async searchAPSUsers(@Args('query') query: string): Promise<User[]> {
    return await this.apsService.searchAPS(query);
  }

  /** Add app user with roles. If user does not exist in db, fetches from APS. */
  @Roles('Admin')
  @Mutation(() => String)
  async addAppUser(
    @Args('userId') userId: string,
    @Args('roles', { type: () => [RoleEnum] }) roles: RoleEnum[]
  ): Promise<string> {
    await this.userService.addAppUser(userId, roles);
    await this.redisCacheService.del(`user-uuid-${userId}`);
    return 'App user added.';
  }

  /** Remove role from user. */
  @Roles('Admin')
  @Mutation(() => String)
  async removeUserRole(
    @Args('userId') userId: number,
    @Args('role', { type: () => RoleEnum }) role: RoleEnum
  ): Promise<string> {
    await this.prisma.userRole.deleteMany({ where: { userId, role } });
    await this.redisCacheService.del(`user-uuid-${userId}`);
    return 'User role removed.';
  }

  // @Query(() => PaginatedUsers)
  // async users(@Args() args: UsersConnectionArgs): Promise<PaginatedUsers> {
  //   const { limit, offset } = getPagingParameters(args);

  //   const realOffset = offset || 0;
  //   const realLimit = Math.min(50, limit || 50);
  //   const realLimitPlusOne = realLimit + 1;

  //   const where: any = { isDeleted: false, rcno: { gt: 0 } };

  //   if (args.searchTerm) {
  //     let rcno: number | null = null;
  //     try {
  //       rcno = parseInt(args.searchTerm);
  //     } catch (error) {}

  //     if (rcno) {
  //       where['rcno'] = rcno;
  //     } else {
  //       where['fullName'] = { search: args.searchTerm };
  //     }
  //   }

  //   const users = await this.prisma.user.findMany({
  //     skip: offset,
  //     take: realLimitPlusOne,
  //     where,
  //     orderBy: { createdAt: 'desc' },
  //   });

  //   const count = await this.prisma.user.count();

  //   const { edges, pageInfo } = connectionFromArraySlice(
  //     users.slice(0, realLimit),
  //     args,
  //     {
  //       arrayLength: count,
  //       sliceStart: realOffset,
  //     }
  //   );

  //   return {
  //     edges,
  //     pageInfo: {
  //       ...pageInfo,
  //       hasNextPage: realOffset + realLimit < count,
  //       hasPreviousPage: realOffset >= realLimit,
  //     },
  //   };
  // }

  @Query(() => [User])
  async searchUser(@Args('query') query: string) {
    const contains = query.trim();
    const take = 10;

    let rcno: number | null = null;
    try {
      // its an rcno
      rcno = parseInt(contains);
      return await this.prisma.user.findMany({ where: { rcno }, take });
    } catch (error) {
      // its a fullName
      return await this.prisma.user.findMany({
        where: {
          fullName: { contains, mode: 'insensitive' },
        },
        take,
      });
    }
  }

  @Roles('Admin')
  @Query(() => [User])
  async appUsers(): Promise<User[]> {
    const users: any = await this.prisma.user.findMany({
      where: { roles: { some: { role: { in: ['Agent', 'Admin'] } } } },
      include: { roles: { orderBy: { role: 'asc' } } },
      orderBy: { rcno: 'asc' },
    });
    users.forEach((user) => {
      user.roles = user.roles.map((role) => role.role);
    });
    return users;
  }
}
