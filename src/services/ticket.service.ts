import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import ConnectionArgs, {
  connectionFromArraySlice,
  getPagingParameters,
} from 'src/common/pagination/connection-args';
import { PaginatedCategory } from 'src/models/pagination/category-connection.model';
import { CategoryConnectionArgs } from 'src/models/args/category-connection.args';
import { Category } from 'src/models/category.model';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';
import { UserService } from './user.service';
import { Ticket } from 'src/models/ticket.model';
@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  //** Create category. */
  async createCategory(name: string) {
    try {
      await this.prisma.category.create({
        data: { name },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Change name of category. */
  async changeCategoryName(id: number, name: string) {
    try {
      await this.prisma.category.update({
        data: { name },
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Delete category. */
  async deleteCategory(id: number) {
    try {
      await this.prisma.category.update({
        where: { id },
        data: { active: false },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Get categories. Results are paginated. User cursor argument to go forward/backward. */
  async getCategoriesWithPagination(
    args: CategoryConnectionArgs
  ): Promise<PaginatedCategory> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { name } = args;
    const where: any = {
      AND: [
        { name: { contains: name ?? '', mode: 'insensitive' } },
        { active: true },
      ],
    };
    const categories = await this.prisma.category.findMany({
      skip: offset,
      take: limitPlusOne,
      orderBy: { name: 'asc' },
      where,
    });
    const count = await this.prisma.category.count({ where });
    const { edges, pageInfo } = connectionFromArraySlice(
      categories.slice(0, limit),
      args,
      {
        arrayLength: count,
        sliceStart: offset,
      }
    );
    return {
      edges,
      pageInfo: {
        ...pageInfo,
        hasNextPage: offset + limit < count,
        hasPreviousPage: offset >= limit,
      },
    };
  }

  //** Search categories. */
  async searchCategories(query: string): Promise<Category[]> {
    const take = 10;
    const contains = query.trim();
    return await this.prisma.category.findMany({
      where: { name: { contains, mode: 'insensitive' } },
      take,
      orderBy: { name: 'asc' },
    });
  }

  //** Create ticket */
  async createTicket(user: User, title: string, body: string) {
    try {
      await this.prisma.ticket.create({
        data: {
          createdById: user.id,
          title,
          body,
          followings: { create: [{ userId: user.id }] },
        },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Set ticket priority */
  async setTicketPriority(id: number, priority: Priority) {
    try {
      await this.prisma.ticket.update({
        where: { id },
        data: { priority },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Set ticket status */
  async setTicketStatus(id: number, status: Status) {
    try {
      await this.prisma.ticket.update({
        where: { id },
        data: { status },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Give feedback for ticket */
  async setTicketFeedback(
    user: User,
    id: number,
    rating: number,
    feedback: string
  ) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating should be between 1 and 5.');
    }
    const ticket = await this.prisma.ticket.findFirst({ where: { id } });
    if (ticket.createdById !== user.id) {
      throw new UnauthorizedException(
        'Feedback can only be given by the creator of the ticket.'
      );
    }
    try {
      await this.prisma.ticket.update({
        where: { id },
        data: { rating, feedback },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Add follower to ticket */
  async addFollower(user: User, ticketId: number, newFollowerId: number) {
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user);
    if (!isAdminOrAgent) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
      });
      if (ticket.createdById !== user.id) {
        throw new UnauthorizedException('Not authorized to add followers.');
      }
    }
    try {
      await this.prisma.ticketFollowing.create({
        data: { ticketId, userId: newFollowerId },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }
}
