import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from 'nestjs-prisma';
import { UserEntity } from 'src/decorators/user.decorator';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TicketAttachment } from 'src/models/ticket-attachment.model';
import { User } from 'src/models/user.model';
import { AttachmentService } from 'src/services/attachment.service';

@Resolver(() => TicketAttachment)
@UseGuards(GqlAuthGuard, RolesGuard)
export class AttachmentResolver {
  constructor(
    private readonly attachmentService: AttachmentService,
    private prisma: PrismaService
  ) {}

  @Query(() => TicketAttachment)
  async ticketAttachment(@Args('id') id: number): Promise<TicketAttachment> {
    return await this.prisma.ticketAttachment.findFirst({ where: { id } });
  }

  @Query(() => [TicketAttachment])
  async ticketAttachments(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number
  ): Promise<TicketAttachment[]> {
    return await this.attachmentService.ticketAttachments(user, ticketId);
  }
}
