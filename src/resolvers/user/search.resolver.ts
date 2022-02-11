import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { User } from '../../models/user.model';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { SearchResult } from 'src/models/search-result.model';

@Resolver(() => SearchResult)
@UseGuards(GqlAuthGuard, RolesGuard)
export class SearchResolver {
  constructor(private userService: UserService) {}

  @Query(() => [SearchResult])
  async searchUsersAndGroups(
    @UserEntity() user: User,
    @Args('query') query: string,
    @Args('onlyAgents') onlyAgents: boolean
  ) {
    return await this.userService.searchUserAndGroups(user, query, onlyAgents);
  }
}
