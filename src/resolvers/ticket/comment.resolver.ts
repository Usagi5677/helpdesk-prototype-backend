import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { pubSub, TicketService } from 'src/services/ticket.service';
import { UserEntity } from 'src/decorators/user.decorator';
import { User } from 'src/models/user.model';
import { PrismaService } from 'nestjs-prisma';
import { TicketComment } from 'src/models/ticket-comment.model';
import { AuthService } from 'src/services/auth.service';

@Resolver(() => TicketComment)
export class CommentResolver {
  constructor(
    private ticketService: TicketService,
    private prisma: PrismaService,
    private authService: AuthService
  ) {}
  @Subscription(() => TicketComment, {
    filter: (payload, variables) => {
      return payload.commentCreated.ticketId === variables.ticketId;
    },
    async resolve(this, payload, variables, context) {
      const isAdminOrAgent = await this.hasAccess(
        context.id,
        payload.commentCreated.ticketId
      );
      if (payload.commentCreated.mode === 'Private' && !isAdminOrAgent) return;
      return payload.commentCreated;
    },
  })
  async commentCreated(@Args('ticketId') ticketId: number) {
    return pubSub.asyncIterator('commentCreated');
  }

  async hasAccess(uuid: string, ticketId: number): Promise<boolean> {
    const user = await this.authService.validateUser(uuid);
    if (!user) throw new UnauthorizedException();
    const [isAdminOrAgent, _] = await this.ticketService.checkTicketAccess(
      user.id,
      ticketId
    );
    return isAdminOrAgent;
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
