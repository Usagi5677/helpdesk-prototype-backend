import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Prisma, TicketFollowing, User } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import {
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
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PUB_SUB } from 'src/resolvers/pubsub/pubsub.module';
import { Cron } from '@nestjs/schedule';
import { TicketStatusCount } from 'src/models/ticket-status-count';
import { ConfigService } from '@nestjs/config';
import { SiteService } from './site.service';
import { RoleEnum } from 'src/common/enums/roles';
@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private notificationService: NotificationService,
    private readonly redisCacheService: RedisCacheService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
    private configService: ConfigService,
    private siteService: SiteService
  ) {}

  //** Create category. */
  async createCategory(name: string, siteId: number) {
    try {
      await this.prisma.category.create({
        data: { name, siteId },
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
    user: User,
    args: CategoryConnectionArgs
  ): Promise<PaginatedCategory> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { name, siteId } = args;
    await this.userService.checkAdminOrAgent(user.id, siteId);
    const where: any = {
      AND: [
        { name: { contains: name ?? '', mode: 'insensitive' } },
        { siteId },
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

  async categoriesWithAccess(user): Promise<Category[]> {
    const sitesWithAccess = await this.siteService.getUserSites(user.id, user);
    const siteIdsWithAccess = sitesWithAccess.map((site) => site.id);
    return await this.prisma.category.findMany({
      where: { siteId: { in: siteIdsWithAccess }, active: true },
      include: { site: true },
    });
  }

  //** Search categories. */
  async searchCategories(query: string, siteId: number): Promise<Category[]> {
    const take = 10;
    const contains = query.trim();
    return await this.prisma.category.findMany({
      where: { name: { contains, mode: 'insensitive' }, siteId },
      take,
      orderBy: { name: 'asc' },
    });
  }

  //** Create ticket. */
  async createTicket(
    user: User,
    title: string,
    body: string,
    siteId: number
  ): Promise<number> {
    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          createdById: user.id,
          title,
          body,
          ticketFollowings: { create: [{ userId: user.id }] },
          siteId,
        },
      });
      await this.createComment(user, ticket.id, body, 'Body');
      return ticket.id;
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

      const ticketUsers = await this.getTicketUserIds(id, user.id);
      for (let index = 0; index < ticketUsers.length; index++) {
        await this.notificationService.createInBackground({
          userId: ticketUsers[index],
          body: `${user.fullName} (${user.rcno}) set priority to ${priority} on ticket ${id}: ${ticket.title}`,
          link: `/ticket/${id}`,
        });
      }
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
        data: { status, statusChangedAt: new Date() },
      });
      const commentBody = `Ticket status set to ${status}.`;
      await this.createComment(user, ticket.id, commentBody, 'Action');

      const ticketUsers = await this.getTicketUserIds(id, user.id);
      for (let index = 0; index < ticketUsers.length; index++) {
        const findUser = await this.prisma.user.findFirst({
          where: {
            id: ticketUsers[index],
          },
        });
        await this.notificationService.createInBackground(
          {
            userId: ticketUsers[index],
            body: `${user.fullName} (${user.rcno}) set status to ${status} on ticket ${id}: ${ticket.title}`,
            link: `/ticket/${id}`,
          },
          {
            to: findUser.email,
            subject: `Ticket status set to ${status}.`,
            html: emailTemplate({
              text: `Ticket <strong>${id}</strong>: <strong>${ticket.title}</strong> has been set to <strong>${status}.</strong>`,
              extraInfo: `By: <strong>${user.fullName} (${user.rcno})</strong>`,
              callToAction: {
                link: `${this.configService.get('APP_URL')}/ticket/${id}`,
                title: 'View Ticket',
              },
            }),
          }
        );
      }
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
      const commentBody = `Ticket ${
        feedback ? 'feedback:' : 'rating'
      } ${feedback} rating:${rating}`;
      await this.createComment(user, ticket.id, commentBody, 'Action');

      const ticketUsers = await this.getTicketUserIds(id, user.id);
      for (let index = 0; index < ticketUsers.length; index++) {
        await this.notificationService.createInBackground({
          userId: ticketUsers[index],
          body: `${user.fullName} (${user.rcno}) gave rating of ${rating}/5 on ticket (${id}): ${ticket.title}`,
          link: `/ticket/${id}`,
        });
      }
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Add follower to ticket. */
  async addFollower(user: User, ticketId: number, newFollowerUserId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    const isAdminOrAgent = await this.userService.isAdminOrAgent(
      user.id,
      ticket.siteId
    );
    if (!isAdminOrAgent) {
      if (ticket.createdById !== user.id) {
        throw new UnauthorizedException('Not authorized to add followers.');
      }
    }
    const [newFollower] = await this.userService.createIfNotExists(
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
      if (user.id !== newFollower.id) {
        const body = `${user.fullName} has added you as a follower to ticket ${ticketId}: ${ticket.title}.`;
        await this.notificationService.createInBackground(
          {
            userId: newFollower.id,
            body,
            link: `/ticket/${ticketId}`,
          },
          {
            to: [newFollower.email],
            subject: `Added as ticket follower`,
            html: emailTemplate({
              text: body,
              extraInfo: `By: <strong>${user.fullName} (${user.rcno})</strong>`,
              callToAction: {
                link: `${this.configService.get('APP_URL')}/ticket/${ticketId}`,
                title: 'View Ticket',
              },
            }),
          }
        );
      }
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
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    const isAdminOrAgent = await this.userService.isAdminOrAgent(
      user.id,
      ticket.siteId
    );
    if (!isAdminOrAgent) {
      if (ticket.createdById !== user.id) {
        throw new UnauthorizedException('Not authorized to remove followers.');
      }
    }
    if (ticket.createdById === deletingFollowerId) {
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
  async assignAgents(
    user: User,
    ticketId: number,
    agentIds: number[],
    isAdmin: boolean,
    siteId: number
  ) {
    // Agents can only assign themselves to ticket.
    if (!isAdmin) {
      if (agentIds.length > 1 && agentIds[0] !== user.id) {
        throw new UnauthorizedException(
          'Agents cannot assign other agents to ticket.'
        );
      }
    }

    // Check if the users being assigned are agents.
    for (const agentId of agentIds) {
      const isAgent = await this.userService.isAgent(agentId, siteId);
      if (!isAgent) {
        throw new BadRequestException(`User is not an agent of this site.`);
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
      const ticketUserIds = await this.getTicketUserIds(ticketId, user.id);
      const ticketUsersExceptNewAssignments = ticketUserIds.filter(
        (id) => !agentIds.includes(id)
      );
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          id: ticketId,
        },
        select: {
          title: true,
        },
      });
      const newAssignments = await this.prisma.user.findMany({
        where: {
          id: { in: agentIds },
        },
        select: {
          id: true,
          fullName: true,
          rcno: true,
          email: true,
        },
      });
      // Text format new assignments into a readable list with commas and 'and'
      // at the end.
      const newAssignmentsFormatted = newAssignments
        .map((a) => `${a.fullName} (${a.rcno})`)
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1');
      // Notification to ticket followers except new assignments
      for (const id of ticketUsersExceptNewAssignments) {
        await this.notificationService.createInBackground({
          userId: id,
          body: `${user.fullName} (${user.rcno}) assigned ${newAssignmentsFormatted} to ticket ${ticketId}: ${ticket.title}`,
          link: `/ticket/${ticketId}`,
        });
      }
      // Notification to new assignments
      const newAssignmentsWithoutCurrentUser = newAssignments.filter(
        (na) => na.id !== user.id
      );
      const emailBody = `You have been assigned to ticket ${ticketId}: ${ticket.title}`;
      for (const newAssignment of newAssignmentsWithoutCurrentUser) {
        await this.notificationService.createInBackground(
          {
            userId: newAssignment.id,
            body: emailBody,
            link: `/ticket/${ticketId}`,
          },
          {
            to: [newAssignment.email],
            subject: `Assigned to ticket`,
            html: emailTemplate({
              text: emailBody,
              extraInfo: `By: <strong>${user.fullName} (${user.rcno})</strong>`,
              callToAction: {
                link: `${this.configService.get('APP_URL')}/ticket/${ticketId}`,
                title: 'View Ticket',
              },
            }),
          }
        );
      }
      const commentBody = `Assigned ${newAssignmentsFormatted} to ticket.`;
      await this.createComment(user, ticketId, commentBody, 'Action');
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
  async setOwner(
    user: User,
    ticketId: number,
    agentId: number,
    siteId: number
  ) {
    const ticketAssignments = await this.prisma.ticketAssignment.findMany({
      where: { ticketId },
    });
    // Check if agent is assigned to ticket.
    const agent = ticketAssignments.find((ta) => ta.userId === agentId);
    if (!agent) {
      throw new BadRequestException(`Agent is not assigned to this ticket.`);
    }
    const transactions = [
      this.prisma.ticketAssignment.update({
        where: { id: agent.id },
        data: { isOwner: true },
      }),
    ];
    // Check for current owner of ticket.
    const currentOwner = ticketAssignments.find((ta) => ta.isOwner);
    // Check if requesting user is an admin
    const isAdmin = await this.userService.isAdmin(user.id, siteId);
    // Prevent if requesting user is not an admin or the current owner
    if (!isAdmin && currentOwner.userId !== user.id) {
      throw new UnauthorizedException(
        `Owner can only be changed by admins or the current owner of ticket.`
      );
    }
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
  async unassignAgent(
    user: User,
    ticketId: number,
    agentId: number,
    siteId: number
  ) {
    const isAdmin = await this.userService.isAdmin(user.id, siteId);
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
      const commentBody = `Created new checklist item: "${description}"`;
      await this.createComment(user, ticketId, commentBody, 'Action');
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
      include: { ticket: true },
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
      if (complete) {
        const commentBody = `Completed checklist item: "${checkListItem.description}"`;
        await this.createComment(
          user,
          checkListItem.ticketId,
          commentBody,
          'Action'
        );
        const ticketUsers = await this.getTicketUserIds(
          checkListItem.ticketId,
          user.id
        );
        for (let index = 0; index < ticketUsers.length; index++) {
          await this.notificationService.createInBackground({
            userId: ticketUsers[index],
            body: `${user.fullName} (${user.rcno}) completed checklist item:${checkListItem.description} on ticket ${id}: ${checkListItem.ticket.title}`,
            link: `/ticket/${id}`,
          });
        }
      }
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
      const commentBody = `Deleted checklist item: "${checkListItem.description}"`;
      await this.createComment(
        user,
        checkListItem.ticketId,
        commentBody,
        'Action'
      );
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Make comment as on a ticket. This function is called directly from a user. */
  async addComment(user: User, ticketId: number, body: string, mode: string) {
    const [isAdminOrAgent] = await this.checkTicketAccess(user.id, ticketId);
    if (!mode || !isAdminOrAgent) mode = 'Public';
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
        include: { user: true, ticket: true },
      });
      await this.pubSub.publish('commentCreated', { commentCreated: comment });

      if (['Public', 'Private', 'Suggestion', 'Resolution'].includes(mode)) {
        const ticketUsers = await this.getTicketUserIds(ticketId, user.id);
        for (let index = 0; index < ticketUsers.length; index++) {
          await this.notificationService.createInBackground({
            userId: ticketUsers[index],
            body: `${user.fullName} (${user.rcno}) commented on ticket ${ticketId}: ${comment.ticket.title}`,
            link: `/ticket/${ticketId}`,
          });
        }
      }
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
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    const isAdminOrAgent = await this.userService.isAdminOrAgent(
      userId,
      ticket.siteId
    );
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
      from,
      to,
      assignedToId,
      followingId,
      siteId,
      all,
    } = args;

    const where: any = { AND: [] };
    if (siteId && all) {
      const sitesWithRoles = await this.siteService.sitesWithRoles(
        user.id,
        [RoleEnum.Admin, RoleEnum.Agent],
        user
      );
      if (sitesWithRoles.includes(siteId)) {
        where.AND.push({ siteId });
      }
    } else if (all) {
      const sitesWithRoles = await this.siteService.sitesWithRoles(
        user.id,
        [RoleEnum.Admin, RoleEnum.Agent],
        user
      );
      where.AND.push({ siteId: { in: sitesWithRoles } });
    } else if (siteId) {
      where.AND.push({ siteId });
    }
    if (createdById) {
      where.AND.push({ createdById });
    }
    if (assignedToId) {
      where.AND.push({ ticketAssignments: { some: { userId: assignedToId } } });
    }
    if (followingId) {
      where.AND.push(
        { ticketFollowings: { some: { userId: followingId } } },
        { createdById: { not: followingId } }
      );
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
        site: true,
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

  // Returns true if the user is an admin, agent or ticket follower.
  async hasTicketAccess(user: User, ticketId: number): Promise<boolean> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      include: { ticketFollowings: true },
    });
    if (!ticket) return false;
    const isAdminOrAgent = await this.userService.isAdminOrAgent(
      user.id,
      ticket.siteId
    );
    if (
      isAdminOrAgent ||
      ticket.ticketFollowings.map((tf) => tf.userId).includes(user.id)
    )
      return true;
    return false;
  }

  // Get ticket details
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
        site: true,
      },
    });
    if (!ticket) throw new BadRequestException('Ticket not found.');
    const isAdminOrAgent = await this.userService.isAdminOrAgent(
      user.id,
      ticket.siteId
    );
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
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    const isAdmin = await this.userService.isAdmin(userId, ticket.siteId);
    if (isAdmin) return true;
    const isAssigned = await this.isAssignedToTicket(userId, ticketId);
    if (isAssigned) return true;
    return false;
  }

  // Cron job runs at 23:59 every day
  @Cron('59 23 * * *')
  async updateDailyStatusHistroy() {
    const now = moment();
    this.logger.verbose('Ticket status history cron job');
    const latest = await this.prisma.ticketStatusHistory.findFirst({
      orderBy: { id: 'desc' },
    });
    // Check if there already are entries for current day to prevent duplicates
    if (latest) {
      const latestTime = moment(latest.createdAt);
      if (latestTime.isSame(now, 'day')) {
        this.logger.verbose('Already exists for today');
        return;
      }
    }
    const sites = await this.prisma.site.findMany();
    const statusCounts: TicketStatusCount[] = [];
    for (const site of sites) {
      for (const status of Object.keys(Status) as Array<keyof typeof Status>) {
        const count = await this.prisma.ticket.count({
          where: {
            status: status,
            siteId: site.id,
          },
        });
        statusCounts.push({
          status: Status[status],
          count,
          siteId: site.id,
        });
      }
    }
    await this.prisma.ticketStatusHistory.createMany({
      data: statusCounts.map((sc) => ({
        status: sc.status,
        count: sc.count,
        siteId: sc.siteId,
      })),
    });
  }

  // Get unique array of ids of ticket followers and assigned agents
  async getTicketUserIds(
    ticketId: number,
    removeUserId?: number
  ): Promise<number[]> {
    // get all users involved in ticket
    const getAssignedAgents = await this.prisma.ticketAssignment.findMany({
      where: {
        ticketId: ticketId,
      },
    });
    const getFollowingUsers = await this.prisma.ticketFollowing.findMany({
      where: {
        ticketId: ticketId,
      },
    });

    // combine the ids
    const combinedIDs = [
      ...getAssignedAgents.map((a) => a.userId),
      ...getFollowingUsers.map((a) => a.userId),
    ];

    // get unique ids only
    const unique = [...new Set(combinedIDs)];

    // If removeUserId variable has not been passed, return array
    if (!removeUserId) {
      return unique;
    }

    // Otherwise remove the given user id from array and then return
    return unique.filter((id) => {
      return id != removeUserId;
    });
  }
}
