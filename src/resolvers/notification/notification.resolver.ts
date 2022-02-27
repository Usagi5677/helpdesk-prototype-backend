import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { Notification } from '../../models/notification.model';
import { PrismaService } from '../../prisma/prisma.service';
import { UserEntity } from '../../decorators/user.decorator';
import { User } from '../../models/user.model';
import { Inject, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import {
  NotificationService,
  pubSubTwo,
} from 'src/services/notification.service';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PUB_SUB } from 'src/resolvers/pubsub/pubsub.module';

enum SUBSCRIPTION_EVENTS {
  newPerson = 'newPerson',
}

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub
  ) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Notification])
  async notifications(@UserEntity() user: User) {
    return await this.prisma.notification.findMany({
      take: 15,
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async readAllNotifications(@UserEntity() user: User) {
    await this.prisma.$queryRaw`
    UPDATE "Notification" N
    SET "readAt" = now()
    WHERE N."userId" = ${user.id} AND N."readAt" IS NULL`;
    return true;
  }

  @UseGuards(GqlAuthGuard)
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

  @Subscription(() => Notification, {
    filter: (payload, variables) => {
      console.log('payload');
      console.log(payload);
      return true;
    },
    async resolve(this: any, payload: { notificationCreated: Notification }) {
      return payload.notificationCreated;
    },
  })
  async notificationCreated() {
    return this.pubSub.asyncIterator('notificationCreated');
  }
}
