import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Site } from 'src/models/site.model';
import { PrismaService } from 'nestjs-prisma';
import { SiteService } from 'src/services/site.service';

@Resolver(() => Site)
@UseGuards(GqlAuthGuard, RolesGuard)
export class SiteResolver {
  constructor(
    private prisma: PrismaService,
    private readonly siteService: SiteService
  ) {}

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async createSite(
    @Args('name') name: string,
    @Args('code') code: string,
    @Args('mode') mode: string
  ): Promise<string> {
    await this.siteService.createSite(name, code, mode);
    return `Successfully created site ${name}.`;
  }

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async editSite(
    @Args('id') id: number,
    @Args('name') name: string,
    @Args('code') code: string,
    @Args('mode') mode: string
    // @Args('isEnabled') isEnabled: boolean
  ): Promise<string> {
    await this.siteService.editSite(id, name, code, mode);
    return `Successfully updated site ${name}.`;
  }

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async deleteSite(@Args('id') id: number): Promise<string> {
    await this.siteService.deleteSite(id);
    return `Successfully deleted site`;
  }

  @Roles('SuperAdmin')
  @Query(() => [Site])
  async sites(): Promise<Site[]> {
    return await this.prisma.site.findMany({
      orderBy: [{ isEnabled: 'desc' }, { id: 'asc' }],
    });
  }
}
