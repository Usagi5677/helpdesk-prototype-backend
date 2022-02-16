import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { pubSub, TicketService } from 'src/services/ticket.service';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { PrismaService } from 'nestjs-prisma';
import { TicketComment } from 'src/models/ticket-comment.model';

@Resolver(() => TicketComment)
export class CommentResolver {
  constructor(
    private ticketService: TicketService,
    private prisma: PrismaService
  ) {}
  @Subscription(() => TicketComment, {
    filter: (payload, variables) => {
      return payload.commentCreated.ticketId === variables.ticketId;
    },
  })
  commentCreated(@Args('ticketId') ticketId: number) {
    const comment = pubSub.asyncIterator('commentCreated');
    return comment;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [TicketComment])
  async comments(
    @UserEntity() user: User,
    @Args('ticketId') ticketId: number
  ): Promise<TicketComment[]> {
    const hasTicketAccess = await this.ticketService.hasTicketAccess(
      user,
      ticketId
    );
    if (!hasTicketAccess) throw new UnauthorizedException('Unauthorized');

    const [isAdminOrAgent, _] = await this.ticketService.checkTicketAccess(
      user.id,
      ticketId
    );
    const where: any = { AND: [{ ticketId }] };
    if (!isAdminOrAgent) where.AND.push({ mode: 'Public' });

    return await this.prisma.ticketComment.findMany({
      where,
      include: { user: true },
      orderBy: { id: 'asc' },
    });
  }
}
