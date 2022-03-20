import {
  InternalServerErrorException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { TicketService } from 'src/services/ticket.service';
import { Ticket } from 'src/models/ticket.model';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';
import { PaginatedTickets } from 'src/models/pagination/ticket-connection.model';
import { TicketConnectionArgs } from 'src/models/args/ticket-connection.args';
import { PrismaService } from 'nestjs-prisma';
import { TicketStatusCount } from 'src/models/ticket-status-count';
import { UserService } from 'src/services/user.service';
import { TicketStatusHistoryConnectionArgs } from 'src/models/args/ticket-status-history-connection.args';
import * as moment from 'moment';
import { TicketStatusCountHistory } from 'src/models/ticket-status-count-history';
import { RedisCacheService } from 'src/redisCache.service';
import { AgentQueue } from 'src/models/agent-queue.model';
import { SiteService } from 'src/services/site.service';
import { RoleEnum } from 'src/common/enums/roles';

@Resolver(() => Ticket)
@UseGuards(GqlAuthGuard, RolesGuard)
export class TicketResolver {
  constructor(
    private ticketService: TicketService,
    private prisma: PrismaService,
    private userService: UserService,
    private readonly redisCacheService: RedisCacheService,
    private siteService: SiteService
  ) {}

  @Mutation(() => Int)
  async createTicket(
    @UserEntity() user: User,
    @Args('title') title: string,
    @Args('body') body: string,
    @Args('siteId') siteId: number
  ): Promise<number> {
    await this.siteService.checkSiteAccess(user.id, siteId);
    return await this.ticketService.createTicket(user, title, body);
  }

  @Mutation(() => String)
  async setTicketPriority(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('priority', { type: () => Priority }) priority: Priority
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    await this.userService.checkAdminOrAgent(user.id, ticket.id);
    await this.ticketService.setTicketPriority(user, ticketId, priority);
    return `Ticket priority set to ${priority}.`;
  }

  @Mutation(() => String)
  async setTicketStatus(
    @UserEntity() user: User,
    @Args('ticketId') id: number,
    @Args('status', { type: () => Status }) status: Status
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: id } });
    await this.userService.checkAdminOrAgent(user.id, ticket.id);
    await this.ticketService.setTicketStatus(user, id, status);
    return `Ticket status set to ${status}.`;
  }

  @Mutation(() => String)
  async giveFeedback(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('rating') rating: number,
    @Args('feedback') feedback: string
  ): Promise<string> {
    await this.ticketService.giveTicketFeedback(
      user,
      ticketId,
      rating,
      feedback
    );
    return `Successfully given ticket feedback.`;
  }

  @Mutation(() => String)
  async addFollower(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('newFollowerUserId') newFollowerUserId: string
  ): Promise<string> {
    await this.ticketService.addFollower(user, ticketId, newFollowerUserId);
    return `Successfully added follower to ticket.`;
  }

  @Mutation(() => String)
  async removeFollower(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('deletingFollowerId') deletingFollowerId: number
  ): Promise<string> {
    await this.ticketService.removeFollower(user, ticketId, deletingFollowerId);
    return `Successfully removed follower from ticket.`;
  }

  @Mutation(() => String)
  async assignAgents(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentIds', { type: () => [Int] }) agentIds: number[]
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    const isAdmin = await this.userService.isAdmin(user.id, ticket.siteId);
    const isAgent = await this.userService.isAgent(user.id, ticket.siteId);
    if (!isAdmin && !isAgent) {
      throw new UnauthorizedException('You do not have access to this ticket.');
    }
    await this.ticketService.assignAgents(
      user,
      ticketId,
      agentIds,
      isAdmin,
      ticket.siteId
    );
    return `Successfully assigned agent${
      agentIds.length > 1 ? 's' : ''
    } to ticket.`;
  }

  @Mutation(() => String)
  async setOwner(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentId') agentId: number
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    await this.userService.checkAdminOrAgent(user.id, ticket.id);
    await this.ticketService.setOwner(user, ticketId, agentId, ticket.siteId);
    return `Successfully set new owner of ticket.`;
  }

  @Mutation(() => String)
  async unassignAgent(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentId') agentId: number
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    await this.userService.checkAdminOrAgent(user.id, ticket.id);
    await this.ticketService.unassignAgent(
      user,
      ticketId,
      agentId,
      ticket.siteId
    );
    return `Successfully unassigned agent to ticket.`;
  }

  @Mutation(() => String)
  async addChecklistItem(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('description') description: string
  ): Promise<string> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
    });
    await this.userService.checkAdminOrAgent(user.id, ticket.id);
    await this.ticketService.createChecklistItem(user, ticketId, description);
    return `Added checklist item to ticket.`;
  }

  @Mutation(() => String)
  async editChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('description') description: string
  ): Promise<string> {
    const checklistItem = await this.prisma.checklistItem.findFirst({
      where: { id },
      include: { ticket: true },
    });
    await this.userService.checkAdminOrAgent(user.id, checklistItem.ticket.id);
    await this.ticketService.editChecklistItem(user, id, description);
    return `Checklist item updated.`;
  }

  @Mutation(() => String)
  async toggleChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('complete') complete: boolean
  ): Promise<string> {
    const checklistItem = await this.prisma.checklistItem.findFirst({
      where: { id },
      include: { ticket: true },
    });
    await this.userService.checkAdminOrAgent(user.id, checklistItem.ticket.id);
    await this.ticketService.toggleChecklistItem(user, id, complete);
    return `Checklist item updated.`;
  }

  @Mutation(() => String)
  async deleteChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number
  ): Promise<string> {
    const checklistItem = await this.prisma.checklistItem.findFirst({
      where: { id },
      include: { ticket: true },
    });
    await this.userService.checkAdminOrAgent(user.id, checklistItem.ticket.id);
    await this.ticketService.deleteChecklistItem(user, id);
    return `Checklist item deleted.`;
  }

  @Mutation(() => String)
  async addComment(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('body') body: string,
    @Args('isPublic', { nullable: true }) mode: boolean
  ): Promise<string> {
    await this.ticketService.addComment(user, ticketId, body, mode);
    return `Comment added to ticket.`;
  }

  @Query(() => PaginatedTickets)
  async myTickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    args.createdById = user.id;
    return await this.ticketService.getTicketsWithPagination(user, args);
  }

  @Query(() => PaginatedTickets)
  async tickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    args.all = true;
    if (args.createdByUserId) {
      const createdBy = await this.prisma.user.findFirst({
        where: { userId: args.createdByUserId },
      });
      if (!createdBy) {
        args.createdById = -1;
      } else {
        args.createdById = createdBy.id;
      }
    }
    return await this.ticketService.getTicketsWithPagination(user, args);
  }

  @Query(() => PaginatedTickets)
  async assignedTickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    args.assignedToId = user.id;
    if (args.createdByUserId) {
      const createdBy = await this.prisma.user.findFirst({
        where: { userId: args.createdByUserId },
      });
      if (!createdBy) {
        args.createdById = -1;
      } else {
        args.createdById = createdBy.id;
      }
    }
    return await this.ticketService.getTicketsWithPagination(user, args);
  }

  @Query(() => PaginatedTickets)
  async followingTickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    args.followingId = user.id;
    if (args.createdByUserId) {
      const createdBy = await this.prisma.user.findFirst({
        where: { userId: args.createdByUserId },
      });
      if (!createdBy) {
        args.createdById = -1;
      } else {
        args.createdById = createdBy.id;
      }
    }
    return await this.ticketService.getTicketsWithPagination(user, args);
  }

  @Query(() => Boolean)
  async hasTicketAccess(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number
  ) {
    return await this.ticketService.hasTicketAccess(user, ticketId);
  }

  @Query(() => Ticket)
  async ticket(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number
  ): Promise<Ticket> {
    return await this.ticketService.ticket(user, ticketId);
  }

  @Mutation(() => String)
  async addTicketCategory(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('categoryId') categoryId: number
  ): Promise<string> {
    const isAdminOrAssigned =
      await this.ticketService.isAdminOrAssignedToTicket(user.id, ticketId);
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
    try {
      await this.prisma.ticketCategory.create({
        data: { ticketId, categoryId },
      });
      return `Category added to ticket.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Mutation(() => String)
  async removeTicketCategory(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('categoryId') categoryId: number
  ): Promise<string> {
    const isAdminOrAssigned =
      await this.ticketService.isAdminOrAssignedToTicket(user.id, ticketId);
    if (!isAdminOrAssigned) throw new UnauthorizedException('Unauthorized.');
    try {
      await this.prisma.ticketCategory.deleteMany({
        where: { ticketId, categoryId },
      });
      return `Category removed from ticket.`;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  @Query(() => [TicketStatusCount])
  async ticketStatusCount(
    @UserEntity() user: User,
    @Args('siteId', { nullable: true }) siteId?: number
  ): Promise<TicketStatusCount[]> {
    let type = 'Self';
    let siteIds = [];
    const sitesWithRoles = await this.siteService.sitesWithRoles(user.id, [
      RoleEnum.Admin,
      RoleEnum.Agent,
    ]);
    if (sitesWithRoles.length > 0) {
      if (siteId && sitesWithRoles.includes(siteId)) {
        type = 'Site';
        siteIds = [siteId];
      } else {
        type = 'OwnSites';
        siteIds = sitesWithRoles;
      }
    }
    let statusCounts = await this.redisCacheService.get(
      `statusCount${
        type === 'Self'
          ? `Self-${user.id}`
          : type === 'Site'
          ? `Site-${siteId}`
          : `OwnSites-${user.id}`
      }`
    );
    if (!statusCounts) {
      statusCounts = [];
      for (const status of Object.keys(Status) as Array<keyof typeof Status>) {
        const count = await this.prisma.ticket.count({
          where: {
            status: status,
            createdById: type === 'Self' ? user.id : undefined,
            siteId: type === 'Self' ? undefined : { in: siteIds },
          },
        });
        statusCounts.push({
          status: Status[status],
          count,
        });
      }
      await this.redisCacheService.setFor10Sec(
        `statusCount${
          type === 'Self'
            ? `Self-${user.id}`
            : type === 'Site'
            ? `Site-${siteId}`
            : `OwnSites-${user.id}`
        }`,
        statusCounts
      );
    }
    return statusCounts;
  }

  @Query(() => [TicketStatusCountHistory])
  async ticketStatusCountHistory(
    @UserEntity() user: User,
    @Args() args: TicketStatusHistoryConnectionArgs
  ): Promise<TicketStatusCountHistory[]> {
    let { statuses } = args;
    const { from, to, siteId } = args;
    const sitesWithRoles = await this.siteService.sitesWithRoles(user.id, [
      RoleEnum.Admin,
      RoleEnum.Agent,
    ]);
    if (sitesWithRoles.length === 0) {
      throw new UnauthorizedException(
        'You do not have priviledged access to any sites.'
      );
    }
    let siteIds = sitesWithRoles;
    if (siteId && sitesWithRoles.includes(siteId)) {
      siteIds = [siteId];
    }
    const today = moment();
    const fromDate = moment(from).startOf('day');
    const toDate = moment(to).endOf('day');
    if (today.isSame(toDate, 'day')) {
      toDate.subtract(1, 'day');
    }
    if (!statuses || statuses.length === 0) {
      statuses = (Object.keys(Status) as Array<keyof typeof Status>).map(
        (s) => Status[s]
      );
    }
    let statusHistoryByDate = await this.redisCacheService.get(
      `statusCountHistory-${statuses.join(',')}-${fromDate.format(
        'DD-MMMM-YYYY'
      )}-${toDate.format('DD-MMMM-YYYY')}`
    );
    if (!statusHistoryByDate) {
      statusHistoryByDate = [];
      const statusHistory = await this.prisma.ticketStatusHistory.findMany({
        where: {
          status: { in: statuses },
          createdAt: { gte: from, lte: toDate.toDate() },
          siteId: { in: siteIds },
        },
      });
      const days = toDate.diff(fromDate, 'days') + 1;
      for (let i = 0; i < days; i++) {
        const day = fromDate.clone().add(i, 'day');
        const statusCounts = statuses.map((status) => ({
          status: status,
          count:
            statusHistory.find(
              (sh) =>
                moment(sh.createdAt).isSame(day, 'day') && sh.status === status
            )?.count ?? 0,
        }));
        statusHistoryByDate.push({
          date: day.toDate(),
          statusCounts,
        });
      }
      await this.redisCacheService.setForDay(
        `statusCountHistory-${statuses.join(',')}-${fromDate.format(
          'DD-MMMM-YYYY'
        )}-${toDate.format('DD-MMMM-YYYY')}`,
        statusHistoryByDate
      );
    }
    return statusHistoryByDate;
  }

  @Query(() => [AgentQueue])
  async agentQueue(@UserEntity() user: User): Promise<AgentQueue[]> {
    let agentQueue = await this.redisCacheService.get(`agentQueue`);
    if (!agentQueue) {
      agentQueue = [];
      const sitesWithRoles = await this.siteService.sitesWithRoles(user.id, [
        RoleEnum.Admin,
        RoleEnum.Agent,
      ]);
      if (sitesWithRoles.length === 0) {
        throw new UnauthorizedException(
          'You do not have priviledged access to any sites.'
        );
      }
      const activeTickets = await this.prisma.ticket.findMany({
        where: {
          status: { in: ['Pending', 'Open', 'Reopened'] },
          siteId: { in: sitesWithRoles },
        },
        include: { ticketAssignments: true },
      });
      const allAgents = await this.prisma.user.findMany({
        where: { roles: { some: { role: 'Agent' } } },
      });
      allAgents.forEach((agent) => {
        const tickets = activeTickets.filter((ticket) => {
          const ticketAssignedIds = ticket.ticketAssignments.map(
            (ta) => ta.userId
          );
          return ticketAssignedIds.includes(agent.id);
        });
        agentQueue.push({
          agent,
          tickets,
        });
      });
      await this.redisCacheService.setFor10Sec(`agentQueue`, agentQueue);
    }
    return agentQueue;
  }
}
