import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from 'src/decorators/user.decorator';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TicketAttachment } from 'src/models/ticket-attachment.model';
import { User } from 'src/models/user.model';
import { AttachmentService } from 'src/services/attachment.service';

@Resolver(() => TicketAttachment)
@UseGuards(GqlAuthGuard, RolesGuard)
export class AttachmentResolver {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Query(() => [TicketAttachment])
  async ticketAttachments(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number
  ): Promise<TicketAttachment[]> {
    return await this.attachmentService.ticketAttachments(user, ticketId);
  }
}
