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

  //** Create ticket. */
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

  //** Set ticket priority. */
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

  //** Set ticket status. */
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

  //** Give feedback for ticket. */
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

  //** Add follower to ticket. */
  async addFollower(user: User, ticketId: number, newFollowerId: number) {
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
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
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          `User is already a follower of this ticket.`
        );
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  //** Remove follower from ticket. */
  async removeFollower(
    user: User,
    ticketId: number,
    deletingFollowerId: number
  ) {
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    if (!isAdminOrAgent) {
      if (ticket.createdById !== user.id) {
        throw new UnauthorizedException('Not authorized to remove followers.');
      }
    }
    if (user.id === deletingFollowerId) {
      throw new BadRequestException(
        `Ticket creator cannot be removed as a follower.`
      );
    }
    try {
      await this.prisma.ticketFollowing.deleteMany({
        where: { ticketId, userId: deletingFollowerId },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Assign agent to ticket. */
  async assignAgent(user: User, ticketId: number, agentId: number) {
    const isAdmin = await this.userService.isAdmin(user.id);
    // Agents can only assign themselves to ticket.
    if (!isAdmin) {
      if (user.id !== agentId) {
        throw new UnauthorizedException(
          'Agents cannot assign other agents to ticket.'
        );
      }
    }
    // Check if the user being assigned is an agent.
    const isAgent = await this.userService.isAgent(agentId);
    if (!isAgent) {
      throw new BadRequestException(`User is not an agent.`);
    }
    // Check current assignments to ticket to see if owner exists. If not, this
    // agent will be assigned as owner.
    const ticketAssignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
    });
    const ownerExists = ticketAssignments.some((ta) => ta.isOwner);
    try {
      await this.prisma.ticketAssignment.create({
        data: { ticketId, userId: agentId, isOwner: !ownerExists },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Agent is already assigned to this ticket.`
        );
      } else {
        console.log(e);
        throw new InternalServerErrorException('Unexpected error occured.');
      }
    }
  }

  //** Set ticket owner agent. */
  async setOwner(ticketId: number, agentId: number) {
    const ticketAssignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
    });
    // Check if agent is assigned to ticket.
    const agent = ticketAssignments.find((ta) => ta.userId === agentId);
    if (!agent) {
      throw new BadRequestException(`Agent is not assigned to this ticket.`);
    }
    let transactions = [
      this.prisma.ticketAssignment.update({
        where: { id: agent.id },
        data: { isOwner: true },
      }),
    ];
    // Check for current owner of ticket.
    const currentOwner = ticketAssignments.find((ta) => ta.isOwner);
    if (currentOwner.userId === agentId) {
      throw new BadRequestException(
        `Agent is already the owner of this ticket.`
      );
    }
    if (currentOwner) {
      transactions.push(
        this.prisma.ticketAssignment.update({
          where: { id: currentOwner.id },
          data: { isOwner: false },
        })
      );
    }
    try {
      await this.prisma.$transaction(transactions);
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Remove agent from ticket. */
  async unassignAgent(user: User, ticketId: number, agentId: number) {
    const isAdmin = await this.userService.isAdmin(user.id);
    // Agents can only remove themselves from ticket.
    if (!isAdmin) {
      if (user.id !== agentId) {
        throw new UnauthorizedException(
          'Agents cannot unassign other agents from ticket.'
        );
      }
    }
    const ticketAssignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
    });
    const agent = ticketAssignments.find((ta) => ta.userId === agentId);
    if (!agent) {
      throw new BadRequestException(`Agent is not assigned to this ticket.`);
    }
    // Check if agent being unassigned is the current owner of ticket.
    const currentOwner = ticketAssignments.find((ta) => ta.isOwner);
    if (currentOwner.userId === agentId) {
      throw new BadRequestException(
        `Ticket owner cannot be unassigned from ticket. Ticket owner must be changed before unassigning this agent from the ticket.`
      );
    }
    try {
      await this.prisma.ticketAssignment.deleteMany({
        where: { ticketId, userId: agentId },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Create checklist item. */
  async createChecklistItem(ticketId: number, description: string) {
    try {
      await this.prisma.checklistItem.create({
        data: { ticketId, description },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Edit checklist item. */
  async editChecklistItem(id: number, description: string) {
    try {
      await this.prisma.checklistItem.update({
        where: { id },
        data: { description },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Complete checklist item. */
  async completeChecklistItem(user: User, id: number) {
    try {
      await this.prisma.checklistItem.update({
        where: { id },
        data: { completedById: user.id, completedAt: new Date() },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Uncomplete checklist item. */
  async uncompleteChecklistItem(id: number) {
    try {
      await this.prisma.checklistItem.update({
        where: { id },
        data: { completedById: null, completedAt: null },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Delete checklist item. */
  async deleteChecklistItem(id: number) {
    try {
      await this.prisma.checklistItem.delete({
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }
}
