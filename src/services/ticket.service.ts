import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, TicketComment, TicketFollowing, User } from '@prisma/client';
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
import { NotificationService } from './notification.service';
import emailTemplate from 'src/common/helpers/emailTemplate';
import { TicketConnectionArgs } from 'src/models/args/ticket-connection.args';
import { PaginatedTickets } from 'src/models/pagination/ticket-connection.model';
import * as moment from 'moment';
import { PubSub } from 'graphql-subscriptions';

export const pubSub = new PubSub();
@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private notificationService: NotificationService,
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
        count,
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
      const ticket = await this.prisma.ticket.create({
        data: {
          createdById: user.id,
          title,
          body,
          ticketFollowings: { create: [{ userId: user.id }] },
        },
      });
      await this.createComment(user, ticket.id, body, 'Body');
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Set ticket priority. */
  async setTicketPriority(user: User, id: number, priority: Priority) {
    try {
      const ticket = await this.prisma.ticket.update({
        where: { id },
        data: { priority },
      });
      const commentBody = `Ticket priority set to ${priority}.`;
      await this.createComment(user, ticket.id, commentBody, 'Action');
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Set ticket status. */
  async setTicketStatus(user: User, id: number, status: Status) {
    try {
      const ticket = await this.prisma.ticket.update({
        where: { id },
        data: { status },
      });
      const commentBody = `Ticket status set to ${status}.`;
      await this.createComment(user, ticket.id, commentBody, 'Action');
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Give feedback for ticket. */
  async giveTicketFeedback(
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
  async addFollower(user: User, ticketId: number, newFollowerUserId: string) {
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    if (!isAdminOrAgent) {
      if (ticket.createdById !== user.id) {
        throw new UnauthorizedException('Not authorized to add followers.');
      }
    }
    const [newFollower, _] = await this.userService.createIfNotExists(
      newFollowerUserId
    );
    if (!newFollower) {
      throw new BadRequestException('Invalid user.');
    }
    try {
      await this.prisma.ticketFollowing.create({
        data: { ticketId, userId: newFollower.id },
      });
      const commentBody = `Added ${newFollower.fullName} (${newFollower.rcno}) as a ticket follower.`;
      await this.createComment(user, ticketId, commentBody, 'Action');
      // const body = `${user.fullName} has added you to a ticket.`;
      // await this.notificationService.createInBackground(
      //   {
      //     userId: newFollower.id,
      //     body,
      //   },
      //   {
      //     to: [newFollower.email],
      //     subject: `Added to ticket`,
      //     html: emailTemplate({
      //       text: body,
      //       // extraInfo: `Submitted By: <strong>${user.rcno} - ${user.fullName}</strong>`,
      //       // callToAction: {
      //       //   link: `${process.env.APP_URL}/cases/${docOnCase.case.id}/#documents`,
      //       //   title: 'View Case Documents',
      //       // },
      //     }),
      //   }
      // );
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
  async assignAgents(user: User, ticketId: number, agentIds: number[]) {
    const isAdmin = await this.userService.isAdmin(user.id);
    // Agents can only assign themselves to ticket.
    if (!isAdmin) {
      if (agentIds.includes(user.id)) {
        throw new UnauthorizedException(
          'Agents cannot assign other agents to ticket.'
        );
      }
    }

    // Check if the users being assigned are agents.
    for (const agentId of agentIds) {
      const isAgent = await this.userService.isAgent(agentId);
      if (!isAgent) {
        throw new BadRequestException(`User is not an agent.`);
      }
    }

    // Check current assignments to ticket to see if owner exists. If not, the
    // first agent will be assigned as owner.
    const ticketAssignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
    });
    const ownerExists = ticketAssignments.some((ta) => ta.isOwner);
    try {
      await this.prisma.ticketAssignment.createMany({
        data: agentIds.map((agentId, index) => ({
          ticketId,
          userId: agentId,
          isOwner: ownerExists ? false : index === 0 ? true : false,
        })),
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
  async createChecklistItem(user: User, ticketId: number, description: string) {
    const isAdminOrAssigned = await this.isAdminOrAssignedToTicket(
      user.id,
      ticketId
    );
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
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
  async editChecklistItem(user: User, id: number, description: string) {
    const checkListItem = await this.prisma.checklistItem.findFirst({
      where: { id },
    });
    const isAdminOrAssigned = await this.isAdminOrAssignedToTicket(
      user.id,
      checkListItem.ticketId
    );
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
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

  //** Set checklist item as complete or incomplete. */
  async toggleChecklistItem(user: User, id: number, complete: boolean) {
    const checkListItem = await this.prisma.checklistItem.findFirst({
      where: { id },
    });
    const isAdminOrAssigned = await this.isAdminOrAssignedToTicket(
      user.id,
      checkListItem.ticketId
    );
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
    try {
      await this.prisma.checklistItem.update({
        where: { id },
        data: complete
          ? { completedById: user.id, completedAt: new Date() }
          : { completedById: null, completedAt: null },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Delete checklist item. */
  async deleteChecklistItem(user: User, id: number) {
    const checkListItem = await this.prisma.checklistItem.findFirst({
      where: { id },
    });
    const isAdminOrAssigned = await this.isAdminOrAssignedToTicket(
      user.id,
      checkListItem.ticketId
    );
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
    try {
      await this.prisma.checklistItem.delete({
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Make comment as on a ticket. This function is called directly from a user. */
  async addComment(
    user: User,
    ticketId: number,
    body: string,
    isPublic: boolean
  ) {
    const [isAdminOrAgent, _] = await this.checkTicketAccess(user.id, ticketId);
    let mode = 'Public';
    if (isAdminOrAgent && isPublic === false) mode = 'Private';
    await this.createComment(user, ticketId, body, mode);
  }

  //** Create comment. Unlike the above function, this function is called within the api. */
  async createComment(
    user: User,
    ticketId: number,
    body: string,
    mode: string
  ) {
    try {
      const comment = await this.prisma.ticketComment.create({
        data: {
          userId: user.id,
          ticketId,
          body,
          mode,
        },
        include: { user: true },
      });
      await pubSub.publish('commentCreated', { commentCreated: comment });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Checks if user is an admin or agent. If not, checks if user is following ticket. If not, prevent access by throwing an exception. */
  async checkTicketAccess(
    userId: number,
    ticketId: number
  ): Promise<[boolean, TicketFollowing]> {
    const isAdminOrAgent = await this.userService.isAdminOrAgent(userId);
    let ticketFollowing: TicketFollowing = null;
    if (!isAdminOrAgent) {
      ticketFollowing = await this.prisma.ticketFollowing.findFirst({
        where: { userId, ticketId },
      });
      if (!ticketFollowing) {
        throw new UnauthorizedException(
          'You do not have access to this ticket.'
        );
      }
    }
    return [isAdminOrAgent, ticketFollowing];
  }

  //** Get user groups. Results are paginated. User cursor argument to go forward/backward. */
  async getTicketsWithPagination(
    user: User,
    args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const {
      search,
      status,
      createdById,
      categoryIds,
      priority,
      self,
      from,
      to,
    } = args;

    // Only these roles can see all results, others can only see thier own tickets
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    if (!self && !isAdminOrAgent) {
      throw new UnauthorizedException('Unauthorized.');
    }
    let where: any = { AND: [] };
    if (createdById) {
      where.AND.push({ createdById });
    }
    if (status) {
      where.AND.push({ status });
    }
    if (status) {
      where.AND.push({ status });
    }
    if (categoryIds && categoryIds.length > 0) {
      where.AND.push({
        ticketCategories: { some: { categoryId: { in: categoryIds } } },
      });
    }
    if (priority) {
      where.AND.push({ priority });
    }
    if (from && to) {
      where.AND.push(
        { createdAt: { gte: moment(from).startOf('day').toDate() } },
        { createdAt: { lte: moment(to).endOf('day').toDate() } }
      );
    }
    if (search) {
      const or: any = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
      // If search contains all numbers, search the ticket ids as well
      if (/^(0|[1-9]\d*)$/.test(search)) {
        or.push({ id: parseInt(search) });
      }
      where.AND.push({
        OR: or,
      });
    }
    const tickets = await this.prisma.ticket.findMany({
      skip: offset,
      take: limitPlusOne,
      where,
      include: {
        createdBy: true,
        ticketCategories: { include: { category: true } },
        ticketAssignments: { include: { user: true } },
        checklistItems: { orderBy: { id: 'asc' } },
      },
      orderBy: { id: 'desc' },
    });

    // Mapping from many to many relationship to a more readable gql form
    const ticketsResp: Ticket[] = [];
    tickets.forEach((ticket) => {
      const ticketResp = new Ticket();
      Object.assign(ticketResp, ticket);
      ticketResp.categories = ticket.ticketCategories.map((tc) => tc.category);
      ticketResp.agents = ticket.ticketAssignments.map((ta) => ta.user);
      if (ticketResp.agents.length > 0) {
        ticketResp.ownerId = ticket.ticketAssignments.find(
          (a) => a.isOwner
        ).userId;
      }
      ticketsResp.push(ticketResp);
    });

    const count = await this.prisma.ticket.count({ where });
    const { edges, pageInfo } = connectionFromArraySlice(
      ticketsResp.slice(0, limit),
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
        count,
        hasNextPage: offset + limit < count,
        hasPreviousPage: offset >= limit,
      },
    };
  }

  async hasTicketAccess(user: User, ticketId: number): Promise<boolean> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      include: { ticketFollowings: true },
    });
    if (!ticket) return false;
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    if (
      isAdminOrAgent ||
      ticket.ticketFollowings.map((tf) => tf.userId).includes(user.id)
    )
      return true;
    return false;
  }

  async ticket(user: User, ticketId: number): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      include: {
        createdBy: true,
        ticketCategories: { include: { category: true } },
        ticketAssignments: { include: { user: true } },
        checklistItems: { orderBy: { id: 'asc' } },
        ticketFollowings: { include: { user: true } },
        comments: true,
        attachments: true,
      },
    });
    if (!ticket) throw new BadRequestException('Ticket not found.');
    const isAdminOrAgent = this.userService.isAdminOrAgent(user.id);
    if (
      !isAdminOrAgent &&
      ticket.createdById !== user.id &&
      !ticket.ticketFollowings.map((tf) => tf.userId).includes(user.id)
    ) {
      throw new UnauthorizedException('You do not have access to this ticket.');
    }
    // Assigning data from db to the gql shape as it does not match 1:1
    const ticketResp = new Ticket();
    Object.assign(ticketResp, ticket);
    ticketResp.categories = ticket.ticketCategories.map((tc) => tc.category);
    ticketResp.agents = ticket.ticketAssignments
      .sort((ta) => (ta.isOwner ? -1 : 1))
      .map((ta) => ta.user);
    if (ticketResp.agents.length > 0) {
      ticketResp.ownerId = ticket.ticketAssignments.find(
        (a) => a.isOwner
      ).userId;
    }
    ticketResp.followers = ticket.ticketFollowings.map((tf) => tf.user);
    return ticketResp;
  }

  async isAssignedToTicket(userId: number, ticketId: number): Promise<boolean> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      include: {
        ticketAssignments: true,
      },
    });
    if (!ticket) return false;
    if (ticket.ticketAssignments.map((ta) => ta.userId).includes(userId))
      return true;
    return false;
  }

  async isAdminOrAssignedToTicket(
    userId: number,
    ticketId: number
  ): Promise<boolean> {
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) return true;
    const isAssigned = await this.isAssignedToTicket(userId, ticketId);
    if (isAssigned) return true;
    return false;
  }
}
