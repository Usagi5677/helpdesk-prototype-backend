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
    @Args('id') id: number,
    @Args('rating') rating: number,
    @Args('feedback') feedback: string
  ): Promise<String> {
    await this.ticketService.setTicketFeedback(user, id, rating, feedback);
    return `Successfully given ticket feedback.`;
  }

  @Mutation(() => String)
  async addFollower(
    @UserEntity() user: User,
    @Args('id') id: number,
    @Args('newFollowerId') newFollowerId: number
  ): Promise<String> {
    await this.ticketService.addFollower(user, id, newFollowerId);
    return `Successfully added follower to ticket.`;
  }
}
