import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { UserGroup } from 'src/models/user-group.model';
import { User } from '@prisma/client';
import { PaginatedUserGroup } from 'src/models/pagination/user-group-connection.model';
import { UserGroupConnectionArgs } from 'src/models/args/user-group-connection.args';

@Resolver(() => UserGroup)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserGroupResolver {
  constructor(private userService: UserService) {}

  @Roles('Admin')
  @Query(() => UserGroup)
  async userGroup(@Args('id') id: number) {
    const [userGroupResp, users] = await this.userService.getUserGroup(id);
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

  @Roles('Admin')
  @Mutation(() => String)
  async createUserGroup(
    @UserEntity() user: User,
    @Args('name') name: string,
    @Args('mode') mode: string
  ): Promise<String> {
    await this.userService.createUserGroup(user, name, mode);
    return `Successfully created user group ${name}.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async changeUserGroupName(
    @Args('id') id: number,
    @Args('name') name: string
  ): Promise<String> {
    await this.userService.changeUserGroupName(id, name);
    return `Changed user group name to ${name}.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async changeUserGroupMode(
    @Args('id') id: number,
    @Args('mode') mode: string
  ): Promise<String> {
    await this.userService.changeUserGroupMode(id, mode);
    return `Changed user group to ${mode}.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async deleteUserGroup(@Args('id') id: number): Promise<String> {
    await this.userService.deleteUserGroup(id);
    return `User group deleted.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async addToUserGroup(
    @Args('userId') userId: number,
    @Args('userGroupId') userGroupId: number
  ): Promise<String> {
    await this.userService.addToUserGroup(userId, userGroupId);
    return `Successfully added user to user group.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async removeFromUserGroup(@Args('id') id: number): Promise<String> {
    await this.userService.removeFromUserGroup(id);
    return `Removed user from user group.`;
  }
}
