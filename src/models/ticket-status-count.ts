import { Field, ObjectType } from '@nestjs/graphql';
import { TicketStatus } from '@prisma/client';
import { Status } from 'src/common/enums/status';

@ObjectType()
export class TicketStatusCount {
  @Field(() => Status)
  status: TicketStatus;

  @Field()
  count: number;

  @Field({ nullable: true, name: 'date' })
  createdAt?: Date;

  siteId?: number;
}
