import { InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { User } from '../../models/user.model';
import { PrismaService } from 'nestjs-prisma';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { Profile } from 'src/models/profile.model';
import { APSService } from 'src/services/aps.service';
import { UserWithRolesAndSites } from 'src/models/user-with-roles.model';
import { RedisCacheService } from 'src/redisCache.service';
import { RoleEnum } from 'src/common/enums/roles';
import { SiteService } from 'src/services/site.service';

@Resolver(() => User)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserResolver {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private apsService: APSService,
    private redisCacheService: RedisCacheService,
    private siteService: SiteService
  ) {}

  @Query(() => UserWithRolesAndSites)
  async me(@UserEntity() user: User): Promise<UserWithRolesAndSites> {
    const userWithRoles = new UserWithRolesAndSites();
    Object.assign(userWithRoles, user);
    userWithRoles.roles = await this.userService.getUserRoles(user.id);
    userWithRoles.sites = await this.siteService.getUserSites(user.id, user);
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
  @Mutation(() => String)
  async addAppUser(
    @UserEntity() user: User,
    @Args('userId') targetUserId: string,
    @Args('roles', { type: () => [RoleEnum] }) roles: RoleEnum[],
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdmin(user.id, siteId);
    await this.userService.addAppUser(targetUserId, roles, siteId);
    return 'App user added.';
  }

  /** Remove role from user. */
  @Mutation(() => String)
  async removeUserRole(
    @UserEntity() user: User,
    @Args('userId') targetUserId: number,
    @Args('role', { type: () => RoleEnum }) role: RoleEnum,
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdmin(user.id, siteId);
    await this.prisma.userRole.deleteMany({
      where: { userId: targetUserId, role, siteId },
    });
    await this.redisCacheService.delPattern(`roles-${targetUserId}-*`);
    return 'User role removed.';
  }

  /** Add user role. */
  @Mutation(() => String)
  async addUserRole(
    @UserEntity() user: User,
    @Args('userId') targetUserId: number,
    @Args('role', { type: () => RoleEnum }) role: RoleEnum,
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdmin(user.id, siteId);
    try {
      await this.prisma.userRole.create({
        data: { userId: targetUserId, role, siteId },
      });
      await this.redisCacheService.delPattern(`roles-${targetUserId}-*`);
      return 'User role removed.';
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

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

  @Query(() => [User])
  async appUsers(
    @UserEntity() user: User,
    @Args('siteId') siteId: number
  ): Promise<User[]> {
    await this.userService.checkAdmin(user.id, siteId);
    const users: any = await this.prisma.user.findMany({
      where: { roles: { some: { role: { in: ['Agent', 'Admin'] }, siteId } } },
      include: { roles: { where: { siteId }, orderBy: { role: 'asc' } } },
      orderBy: { rcno: 'asc' },
    });
    return users;
  }
}
