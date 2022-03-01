import { Field, ObjectType } from '@nestjs/graphql';
import { TicketStatusCount } from './ticket-status-count';

@ObjectType()
export class TicketStatusCountHistory {
  @Field()
  date: Date;

  @Field(() => [TicketStatusCount])
  statusCounts: TicketStatusCount[];
}
