import {
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Site } from 'src/models/site.model';
import { PrismaService } from 'nestjs-prisma';

@Resolver(() => Site)
@UseGuards(GqlAuthGuard, RolesGuard)
export class SiteResolver {
  constructor(private prisma: PrismaService) {}

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async createSite(
    @Args('name') name: string,
    @Args('mode') mode: string
  ): Promise<String> {
    if (!['Public', 'Private'].includes(mode)) {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.site.create({
        data: {
          name,
          mode,
        },
      });
      return `Successfully created site ${name}.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async editSite(
    @Args('id') id: number,
    @Args('name') name: string,
    @Args('mode') mode: string
    // @Args('isEnabled') isEnabled: boolean
  ): Promise<String> {
    if (!['Public', 'Private'].includes(mode)) {
      throw new BadRequestException('Invalid mode.');
    }
    try {
      await this.prisma.site.update({
        where: { id },
        data: {
          name,
          mode,
          // isEnabled,
        },
      });
      return `Successfully updated site ${name}.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Roles('SuperAdmin')
  @Mutation(() => String)
  async deleteSite(@Args('id') id: number): Promise<String> {
    try {
      await this.prisma.site.delete({
        where: { id },
      });
      return `Successfully deleted site`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Roles('SuperAdmin')
  @Query(() => [Site])
  async sites(): Promise<Site[]> {
    return await this.prisma.site.findMany({
      orderBy: [{ isEnabled: 'desc' }, { id: 'asc' }],
    });
  }
}
