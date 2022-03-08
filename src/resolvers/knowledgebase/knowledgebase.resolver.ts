import {
  InternalServerErrorException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { UserService } from 'src/services/user.service';
import { PrismaService } from 'nestjs-prisma';
import { KnowledgebaseService } from 'src/services/knowledgebase.service';
import { KnowledgebaseConnectionArgs } from 'src/models/args/knowledgebase-connection.args';
import { PaginatedKnowledgebase } from 'src/models/pagination/knowledgebase-connection.model';
import { Knowledgebase } from 'src/models/knowledgebase.model';

@Resolver(() => Knowledgebase)
@UseGuards(GqlAuthGuard, RolesGuard)
export class KnowledgebaseResolver {
  constructor(
    private knowledgebaseService: KnowledgebaseService,
    private userService: UserService,
    private prisma: PrismaService
  ) {}
  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async createKnowledgebase(
    @UserEntity() user: User,
    @Args('title') title: string,
    @Args('body') body: string,
    @Args('mode') mode: string
  ): Promise<string> {
    await this.knowledgebaseService.createKnowledgebase(
      user,
      title,
      body,
      mode
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

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async removeKnowledgebase(
    @UserEntity() user: User,
    @Args('knowledgebaseId') knowledgebaseId: number
  ): Promise<string> {
    const isAdminOrAgent = this.userService.isAdminOrAgent(user.id);
    if (!isAdminOrAgent) throw new UnauthorizedException('Unauthorized.');
    try {
      await this.knowledgebaseService.deleteKnowledgebase(knowledgebaseId);
      return `Knowledge base removed.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async editKnowledgebase(
    @Args('id') id: number,
    @Args('title') title: string,
    @Args('body') body: string,
    @Args('mode') mode: string
  ): Promise<string> {
    await this.knowledgebaseService.changeKnowledgebase(id, title, body, mode);
    return `Knowledge base updated.`;
  }
}
