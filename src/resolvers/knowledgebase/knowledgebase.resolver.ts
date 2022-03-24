import { InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { UserService } from 'src/services/user.service';
import { KnowledgebaseService } from 'src/services/knowledgebase.service';
import { KnowledgebaseConnectionArgs } from 'src/models/args/knowledgebase-connection.args';
import { PaginatedKnowledgebase } from 'src/models/pagination/knowledgebase-connection.model';
import { Knowledgebase } from 'src/models/knowledgebase.model';
import { PrismaService } from 'nestjs-prisma';

@Resolver(() => Knowledgebase)
@UseGuards(GqlAuthGuard)
export class KnowledgebaseResolver {
  constructor(
    private knowledgebaseService: KnowledgebaseService,
    private userService: UserService,
    private prisma: PrismaService
  ) {}

  @Mutation(() => String)
  async createKnowledgebase(
    @UserEntity() user: User,
    @Args('title') title: string,
    @Args('body') body: string,
    @Args('mode') mode: string,
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdminOrAgent(user.id, siteId);
    await this.knowledgebaseService.createKnowledgebase(
      user,
      title,
      body,
      mode,
      siteId
    );
    return `Successfully created knowledge base.`;
  }

  @Query(() => PaginatedKnowledgebase)
  async getAllKnowledgebase(
    @UserEntity() user: User,
    @Args() args: KnowledgebaseConnectionArgs
  ): Promise<PaginatedKnowledgebase> {
    return await this.knowledgebaseService.getKnowledgebaseWithPagination(
      user,
      args
    );
  }

  @Query(() => Knowledgebase)
  async singleKnowledgebase(
    @UserEntity() user: User,
    @Args('knowledgebaseId') knowledgebaseId: number
  ): Promise<Knowledgebase> {
    return await this.knowledgebaseService.singleKnowledgebase(
      user,
      knowledgebaseId
    );
  }

  @Mutation(() => String)
  async removeKnowledgebase(
    @UserEntity() user: User,
    @Args('knowledgebaseId') knowledgebaseId: number
  ): Promise<string> {
    const knowledegebase = await this.prisma.information.findFirst({
      where: { id: knowledgebaseId },
    });
    await this.userService.checkAdmin(user.id, knowledegebase.siteId);
    try {
      await this.knowledgebaseService.deleteKnowledgebase(knowledgebaseId);
      return `Knowledge base removed.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Mutation(() => String)
  async editKnowledgebase(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('title') title: string,
    @Args('body') body: string,
    @Args('mode') mode: string
  ): Promise<string> {
    await this.knowledgebaseService.changeKnowledgebase(
      user,
      id,
      title,
      body,
      mode
    );
    return `Knowledge base updated.`;
  }
}
