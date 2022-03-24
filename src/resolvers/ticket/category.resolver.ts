import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Category } from 'src/models/category.model';
import { TicketService } from 'src/services/ticket.service';
import { PaginatedCategory } from 'src/models/pagination/category-connection.model';
import { CategoryConnectionArgs } from 'src/models/args/category-connection.args';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { UserService } from 'src/services/user.service';
import { PrismaService } from 'nestjs-prisma';

@Resolver(() => Category)
@UseGuards(GqlAuthGuard, RolesGuard)
export class CategoryResolver {
  constructor(
    private ticketService: TicketService,
    private userService: UserService,
    private prisma: PrismaService
  ) {}

  @Mutation(() => String)
  async createCategory(
    @UserEntity() user: User,
    @Args('name') name: string,
    @Args('siteId') siteId: number
  ): Promise<string> {
    await this.userService.checkAdmin(user.id, siteId);
    await this.ticketService.createCategory(name, siteId);
    return `Successfully created category ${name}.`;
  }

  @Mutation(() => String)
  async changeCategoryName(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('name') name: string
  ): Promise<string> {
    const category = await this.prisma.category.findFirst({ where: { id } });
    await this.userService.checkAdmin(user.id, category.siteId);
    await this.ticketService.changeCategoryName(id, name);
    return `Changed category name to ${name}.`;
  }

  @Mutation(() => String)
  async deleteCategory(
    @UserEntity() user: User,
    @Args('id') id: number
  ): Promise<string> {
    const category = await this.prisma.category.findFirst({ where: { id } });
    await this.userService.checkAdmin(user.id, category.siteId);
    await this.ticketService.deleteCategory(id);
    return `Category deleted.`;
  }

  @Query(() => PaginatedCategory)
  async categories(
    @UserEntity() user: User,
    @Args() args: CategoryConnectionArgs
  ) {
    return await this.ticketService.getCategoriesWithPagination(user, args);
  }

  @Query(() => [Category])
  async categoriesWithAccess(@UserEntity() user: User) {
    return await this.ticketService.categoriesWithAccess(user);
  }
}
