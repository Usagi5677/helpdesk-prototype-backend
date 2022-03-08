import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Category } from 'src/models/category.model';
import { TicketService } from 'src/services/ticket.service';
import { PaginatedCategory } from 'src/models/pagination/category-connection.model';
import { CategoryConnectionArgs } from 'src/models/args/category-connection.args';

@Resolver(() => Category)
@UseGuards(GqlAuthGuard, RolesGuard)
export class CategoryResolver {
  constructor(private ticketService: TicketService) {}

  @Roles('Admin')
  @Mutation(() => String)
  async createCategory(@Args('name') name: string): Promise<string> {
    await this.ticketService.createCategory(name);
    return `Successfully created category ${name}.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async changeCategoryName(
    @Args('id') id: number,
    @Args('name') name: string
  ): Promise<string> {
    await this.ticketService.changeCategoryName(id, name);
    return `Changed category name to ${name}.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async deleteCategory(@Args('id') id: number): Promise<string> {
    await this.ticketService.deleteCategory(id);
    return `Category deleted.`;
  }

  @Query(() => PaginatedCategory)
  async categories(@Args() args: CategoryConnectionArgs) {
    return await this.ticketService.getCategoriesWithPagination(args);
  }
}
