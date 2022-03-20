import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { UserGroup } from 'src/models/user-group.model';
import { User } from '@prisma/client';
import { PaginatedUserGroup } from 'src/models/pagination/user-group-connection.model';
import { UserGroupConnectionArgs } from 'src/models/args/user-group-connection.args';
import { PrismaService } from 'nestjs-prisma';

@Resolver(() => UserGroup)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserGroupResolver {
  constructor(
    private userService: UserService,
    private prisma: PrismaService
  ) {}

  @Query(() => UserGroup)
  async userGroup(@UserEntity() user: User, @Args('id') id: number) {
    const [userGroupResp, users] = await this.userService.getUserGroup(id);
    await this.userService.checkAdmin(user.id, userGroupResp.siteId);
    const userGroup = new UserGroup();
    Object.assign(userGroup, userGroupResp);
    userGroup.users = users;
    return userGroup;
  }

  @Query(() => PaginatedUserGroup)
  async userGroups(
    @UserEntity() user: User,
    @Args() args: UserGroupConnectionArgs
  ) {
    return await this.userService.getUserGroupsWithPagination(user, args);
  }

  @Mutation(() => String)
  async createUserGroup(
    @UserEntity() user: User,
    @Args('name') name: string,
    @Args('mode') mode: string,
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdmin(user.id, siteId);
    await this.userService.createUserGroup(user, name, mode, siteId);
    return `Successfully created user group ${name}.`;
  }

  @Mutation(() => String)
  async editUserGroup(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('name') name: string,
    @Args('mode') mode: string
  ): Promise<string> {
    const userGroup = await this.prisma.userGroup.findFirst({ where: { id } });
    await this.userService.checkAdmin(user.id, userGroup.siteId);
    await this.userService.editUserGroup(id, name, mode);
    return `User group updated.`;
  }

  @Mutation(() => String)
  async deleteUserGroup(
    @UserEntity() user: User,
    @Args('id') id: number
  ): Promise<string> {
    const userGroup = await this.prisma.userGroup.findFirst({ where: { id } });
    await this.userService.checkAdmin(user.id, userGroup.siteId);
    await this.userService.deleteUserGroup(id);
    return `User group deleted.`;
  }

  @Mutation(() => String)
  async addToUserGroup(
    @UserEntity() user: User,
    @Args('userId') userId: string,
    @Args('userGroupId') userGroupId: number
  ): Promise<string> {
    const userGroup = await this.prisma.userGroup.findFirst({
      where: { id: userGroupId },
    });
    await this.userService.checkAdmin(user.id, userGroup.siteId);
    await this.userService.addToUserGroup(userId, userGroupId);
    return `Successfully added user to user group.`;
  }

  @Mutation(() => String)
  async removeFromUserGroup(
    @UserEntity() user: User,
    @Args('userId') userId: number,
    @Args('userGroupId') userGroupId: number
  ): Promise<string> {
    const userGroup = await this.prisma.userGroup.findFirst({
      where: { id: userGroupId },
    });
    await this.userService.checkAdmin(user.id, userGroup.siteId);
    await this.userService.removeFromUserGroup(userId, userGroupId);
    return `Removed user from user group.`;
  }
}
