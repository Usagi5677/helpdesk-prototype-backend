import { PrismaService } from 'nestjs-prisma';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import {
  connectionFromArraySlice,
  getPagingParameters,
} from 'src/common/pagination/connection-args';
import { UserService } from './user.service';
import { KnowledgebaseConnectionArgs } from 'src/models/args/knowledgebase-connection.args';
import { PaginatedKnowledgebase } from 'src/models/pagination/knowledgebase-connection.model';
import { Knowledgebase } from 'src/models/knowledgebase.model';
import { SiteService } from './site.service';

@Injectable()
export class KnowledgebaseService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private siteService: SiteService
  ) {}

  //** Create knowledgebase. */
  async createKnowledgebase(
    user: User,
    title: string,
    body: string,
    mode: string,
    siteId: number
  ) {
    try {
      await this.prisma.information.create({
        data: {
          createdById: user.id,
          title,
          body,
          mode,
          siteId,
        },
      });
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unexpected error occured.');
    }
  }

  //** Change title, body of knowledgebase. */
  async changeKnowledgebase(
    user: User,
    id: number,
    title: string,
    body: string,
    mode: string
  ) {
    const knowledgebase = await this.prisma.information.findFirst({
      where: { id },
    });
    if (!knowledgebase) {
      throw new BadRequestException('Knowledgebase does not exist.');
    }
    await this.userService.checkAdminOrAgent(user.id, knowledgebase.siteId);
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
    if (!knowledgebase) {
      throw new BadRequestException('Knowledge base not found.');
    }
    await this.siteService.checkSiteAccess(user.id, knowledgebase.siteId, user);
    return knowledgebase;
  }

  //** Get knowldegebase. Results are paginated. User cursor argument to go forward/backward. */
  async getKnowledgebaseWithPagination(
    user: User,
    args: KnowledgebaseConnectionArgs
  ): Promise<PaginatedKnowledgebase> {
    const { limit, offset } = getPagingParameters(args);
    const limitPlusOne = limit + 1;
    const { createdById, search, siteId } = args;

    // Show only public knowledgebases and knowledgebases in sites with access
    const sitesWithAccess = await this.siteService.getUserSites(user.id, user);
    const sitesIdsWithAccess = sitesWithAccess.map((site) => site.id);

    const where: any = {
      AND: [
        {
          OR: [{ mode: 'Public' }, { siteId: { in: sitesIdsWithAccess } }],
        },
      ],
    };

    if (siteId) {
      if (sitesIdsWithAccess.includes(siteId)) {
        where.AND.push({ siteId });
      } else {
        throw new UnauthorizedException('You do now have access to this site.');
      }
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
        site: true,
      },
      orderBy: { id: 'desc' },
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
