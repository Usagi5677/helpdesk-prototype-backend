import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { TicketService } from 'src/services/ticket.service';
import { Ticket } from 'src/models/ticket.model';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';

@Resolver(() => Ticket)
@UseGuards(GqlAuthGuard, RolesGuard)
export class TicketResolver {
  constructor(private ticketService: TicketService) {}

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
    @Args('id') id: number,
    @Args('priority') priority: Priority
  ): Promise<String> {
    await this.ticketService.setTicketPriority(id, priority);
    return `Ticket priority set to ${priority}.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async setTicketStatus(
    @Args('id') id: number,
    @Args('status') status: Status
  ): Promise<String> {
    await this.ticketService.setTicketStatus(id, status);
    return `Ticket status set to ${status}.`;
  }

  @Mutation(() => String)
  async giveFeedback(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('rating') rating: number,
    @Args('feedback') feedback: string
  ): Promise<String> {
    await this.ticketService.setTicketFeedback(
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
    @Args('newFollowerId') newFollowerId: number
  ): Promise<String> {
    const newFollower = await this.ticketService.addFollower(
      user,
      ticketId,
      newFollowerId
    );
    return `Successfully added ${newFollower.fullName} to ticket.`;
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
  async assignAgent(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number,
    @Args('agentId') agentId: number
  ): Promise<String> {
    await this.ticketService.assignAgent(user, ticketId, agentId);
    return `Successfully assigned agent to ticket.`;
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
    @Args('ticketId') ticketId: number,
    @Args('description') description: string
  ): Promise<String> {
    await this.ticketService.createChecklistItem(ticketId, description);
    return `Added checklist item to ticket.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async editChecklistItem(
    @Args('id') id: number,
    @Args('description') description: string
  ): Promise<String> {
    await this.ticketService.editChecklistItem(id, description);
    return `Checklist item updated.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async completeChecklistItem(
    @UserEntity() user: User,
    @Args('id') id: number
  ): Promise<String> {
    await this.ticketService.completeChecklistItem(user, id);
    return `Checklist item marked as complete.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async uncompleteChecklistItem(@Args('id') id: number): Promise<String> {
    await this.ticketService.uncompleteChecklistItem(id);
    return `Checklist item marked as not complete.`;
  }

  @Roles('Admin', 'Agent')
  @Mutation(() => String)
  async deleteChecklistItem(@Args('id') id: number): Promise<String> {
    await this.ticketService.deleteChecklistItem(id);
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
}
