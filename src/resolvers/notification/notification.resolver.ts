import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Notification } from '../../models/notification.model';
import { PrismaService } from '../../prisma/prisma.service';
import { UserEntity } from '../../decorators/user.decorator';
import { User } from '../../models/user.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';

@UseGuards(GqlAuthGuard)
@Resolver(() => Notification)
export class NotificationResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [Notification])
  async notifications(@UserEntity() user: User) {
    return await this.prisma.notification.findMany({
      take: 15,
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Mutation(() => Boolean)
  async readAllNotifications(@UserEntity() user: User) {
    await this.prisma.$queryRaw`
    UPDATE "Notification" N
    SET "readAt" = now()
    WHERE N."userId" = ${user.id} AND N."readAt" IS NULL`;
    return true;
  }

  @Mutation(() => Boolean)
  async readNotification(
    @UserEntity() user: User,
    @Args('notificationId', { type: () => Int }) notificationId: number
  ) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return true;
  }
}
