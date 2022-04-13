import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserService } from 'src/services/user.service';
import { SearchResult } from 'src/models/search-result.model';

@Resolver(() => SearchResult)
@UseGuards(GqlAuthGuard, RolesGuard)
export class SearchResolver {
  constructor(private userService: UserService) {}

  @Query(() => [SearchResult])
  async searchUsersAndGroups(
    @Args('query') query: string,
    @Args('siteId') siteId: number,
    @Args('onlyAgents') onlyAgents: boolean
  ) {
    return await this.userService.searchUserAndGroups(
      query,
      siteId,
      onlyAgents
    );
  }
}
