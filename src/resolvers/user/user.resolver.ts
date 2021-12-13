import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UserEntity } from '../../decorators/user.decorator';
import { GqlAuthGuard } from '../../guards/gql-auth.guard';
import { User } from '../../models/user.model';
import { PrismaService } from 'nestjs-prisma';
import { UsersConnectionArgs } from '../../models/args/user-connection.args';
import { PaginatedUsers } from '../../models/pagination/user-connection.model';
import {
  connectionFromArraySlice,
  getPagingParameters,
} from '../../common/pagination/connection-args';

@Resolver(() => User)
@UseGuards(GqlAuthGuard)
export class UserResolver {
  constructor(private prisma: PrismaService) {}

  @Query(() => User)
  async me(@UserEntity() user: User): Promise<User> {
    return user;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => PaginatedUsers)
  async users(@Args() args: UsersConnectionArgs): Promise<PaginatedUsers> {
    const { limit, offset } = getPagingParameters(args);

    const realOffset = offset || 0;
    const realLimit = Math.min(50, limit || 50);
    const realLimitPlusOne = realLimit + 1;

    const where: any = { isDeleted: false, rcno: { gt: 0 } };

    if (args.searchTerm) {
      let rcno: number | null = null;
      try {
        rcno = parseInt(args.searchTerm);
      } catch (error) {}

      if (rcno) {
        where['rcno'] = rcno;
      } else {
        where['fullName'] = { search: args.searchTerm };
      }
    }

    const users = await this.prisma.user.findMany({
      skip: offset,
      take: realLimitPlusOne,
      where,
      orderBy: { createdAt: 'desc' },
    });

    const count = await this.prisma.user.count();

    const { edges, pageInfo } = connectionFromArraySlice(
      users.slice(0, realLimit),
      args,
      {
        arrayLength: count,
        sliceStart: realOffset,
      }
    );

    return {
      edges,
      pageInfo: {
        ...pageInfo,
        hasNextPage: realOffset + realLimit < count,
        hasPreviousPage: realOffset >= realLimit,
      },
    };
  }

  @Query(() => [User])
  async searchUser(@Args('query') query: string) {
    const contains = query.trim();
    const take = 10;

    let rcno: number | null = null;
    try {
      // its an rcno
      rcno = parseInt(contains);
      return await this.prisma.user.findMany({ where: { rcno }, take });
    } catch (error) {
      // its a fullName
      return await this.prisma.user.findMany({
        where: {
          fullName: { contains, mode: 'insensitive' },
        },
        take,
      });
    }
  }
}
