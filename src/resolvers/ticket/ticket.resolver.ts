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

@Resolver(() => Ticket)
@UseGuards(GqlAuthGuard, RolesGuard)
export class TicketResolver {
  constructor(
    private ticketService: TicketService,
    private prisma: PrismaService
  ) {}

  @Mutation(() => String)
  async createTicket(
    @UserEntity() user: User,
    @Args('title') title: string,
    @Args('body') body: string
  ): Promise<String> {
    await this.ticketService.createTicket(user, title, body);
    return `Successfully created ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async setTicketPriority(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('priority', { type: () => Priority }) priority: Priority
  ): Promise<String> {
    await this.ticketService.setTicketPriority(user, ticketId, priority);
    return `Ticket priority set to ${priority}.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async setTicketStatus(
    @UserEntity() user: User,
    @Args('ticketId') id: number,
    @Args('status', { type: () => Status }) status: Status
  ): Promise<String> {
    await this.ticketService.setTicketStatus(user, id, status);
    return `Ticket status set to ${status}.`;
  }

  @Mutation(() => String)
  async giveFeedback(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('rating') rating: number,
    @Args('feedback') feedback: string
  ): Promise<String> {
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
  ): Promise<String> {
    await this.ticketService.addFollower(user, ticketId, newFollowerUserId);
    return `Successfully added follower to ticket.`;
  }

  @Mutation(() => String)
  async removeFollower(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('deletingFollowerId') deletingFollowerId: number
  ): Promise<String> {
    await this.ticketService.removeFollower(user, ticketId, deletingFollowerId);
    return `Successfully removed follower from ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async assignAgents(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentIds', { type: () => [Int] }) agentIds: number[]
  ): Promise<String> {
    await this.ticketService.assignAgents(user, ticketId, agentIds);
    return `Successfully assigned agent${
      agentIds.length > 1 ? 's' : ''
    } to ticket.`;
  }

  @Roles('Admin')
  @Mutation(() => String)
  async setOwner(
    @Args('ticketId') ticketId: number,
    @Args('agentId') agentId: number
  ): Promise<String> {
    await this.ticketService.setOwner(ticketId, agentId);
    return `Successfully set new owner of ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async unassignAgent(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentId') agentId: number
  ): Promise<String> {
    await this.ticketService.unassignAgent(user, ticketId, agentId);
    return `Successfully unassigned agent to ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async addChecklistItem(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('description') description: string
  ): Promise<String> {
    await this.ticketService.createChecklistItem(user, ticketId, description);
    return `Added checklist item to ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async editChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('description') description: string
  ): Promise<String> {
    await this.ticketService.editChecklistItem(user, id, description);
    return `Checklist item updated.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async toggleChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('complete') complete: boolean
  ): Promise<String> {
    await this.ticketService.toggleChecklistItem(user, id, complete);
    return `Checklist item updated.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async deleteChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number
  ): Promise<String> {
    await this.ticketService.deleteChecklistItem(user, id);
    return `Checklist item deleted.`;
  }

  @Mutation(() => String)
  async addComment(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('body') body: string,
    @Args('isPublic', { nullable: true }) mode: boolean
  ): Promise<String> {
    await this.ticketService.addComment(user, ticketId, body, mode);
    return `Comment added to ticket.`;
  }

  @Query(() => PaginatedTickets)
  async myTickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    (args.self = true), (args.createdById = user.id);
    return await this.ticketService.getTicketsWithPagination(user, args);
  }

  @Roles('Admin', 'Agent')
  @Query(() => PaginatedTickets)
  async tickets(
    @UserEntity() user: User,
    @Args() args: TicketConnectionArgs
  ): Promise<PaginatedTickets> {
    args.self = false;
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

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async addTicketCategory(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('categoryId') categoryId: number
  ): Promise<String> {
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

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async removeTicketCategory(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('categoryId') categoryId: number
  ): Promise<String> {
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
}
