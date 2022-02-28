import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { RedisCacheService } from 'src/redisCache.service';
import ConnectionArgs, {
  connectionFromArraySlice,
  getPagingParameters,
} from 'src/common/pagination/connection-args';
import { UserService } from './user.service';
import { KnowledgebaseConnectionArgs } from 'src/models/args/knowledgebase-connection.args';
import { PaginatedKnowledgebase } from 'src/models/pagination/knowledgebase-connection.model';
import { Knowledgebase } from 'src/models/knowledgebase.model';
import { NotificationService } from './notification.service';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PUB_SUB } from 'src/resolvers/pubsub/pubsub.module';

@Injectable()
export class KnowledgebaseService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private readonly redisCacheService: RedisCacheService,
    private readonly notificationService: NotificationService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub
  ) {}

  //** Create knowledgebase. */
  async createKnowledgebase(
    user: User,
    title: string,
    body: string,
    mode: string
  ) {
    try {
      const notif = await this.prisma.information.create({
        data: {
          createdById: user.id,
          title,
          body,
          mode,
        },
      });
      await this.notificationService.createInBackground(
        {
          userId: user.id,
          body: body,
        },
        {}
      );
      await this.pubSub.publish('notificationCreated', {
        notificationCreated: notif,
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Change title, body of knowledgebase. */
  async changeKnowledgebase(
    id: number,
    title: string,
    body: string,
    mode: string
  ) {
    try {
      await this.prisma.information.update({
        data: {
          title,
          body,
          mode,
        },
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Delete knowledgebase. */
  async deleteKnowledgebase(id: number) {
    try {
      await this.prisma.information.delete({
        where: { id },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }
  //** Get single knowledgebase. */
  async singleKnowledgebase(
    user: User,
    knowledgebaseId: number
  ): Promise<Knowledgebase> {
    const knowledgebase = await this.prisma.information.findFirst({
      where: { id: knowledgebaseId },
      include: {
        createdBy: true,
      },
    });
    if (!knowledgebase)
      throw new BadRequestException('Knowledge base not found.');
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    if (!isAdminOrAgent) {
      throw new UnauthorizedException(
        'You do not have access to this knowledge base.'
      );
    }
    return knowledgebase;
  }

  //** Get knowldegebase. Results are paginated. User cursor argument to go forward/backward. */
  async getKnowledgebaseWithPagination(
    user: User,
    args: KnowledgebaseConnectionArgs
  ): Promise<PaginatedKnowledgebase> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { createdById, search } = args;

    // Only these roles can see all private results, others can only see only public knowledgebase
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    let where: any = { AND: [] };
    if (!isAdminOrAgent) {
      where.AND.push({
        mode: 'Public',
      });
    }
    if (createdById) {
      where.AND.push({ createdById });
    }
    if (search) {
      const or: any = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
      // If search contains all numbers, search the knowledgebase ids as well
      if (/^(0|[1-9]\d*)$/.test(search)) {
        or.push({ id: parseInt(search) });
      }
      where.AND.push({
        OR: or,
      });
    }
    const knowledgebase = await this.prisma.information.findMany({
      skip: offset,
      take: limitPlusOne,
      where,
      include: {
        createdBy: true,
      },
    });

    const count = await this.prisma.information.count({ where });
    const { edges, pageInfo } = connectionFromArraySlice(
      knowledgebase.slice(0, limit),
      args,
      {
        arrayLength: count,
        sliceStart: offset,
      }
    );
    return {
      edges,
      pageInfo: {
        ...pageInfo,
        count,
        hasNextPage: offset + limit < count,
        hasPreviousPage: offset >= limit,
      },
    };
  }
}
