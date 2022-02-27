import { Field, ObjectType } from '@nestjs/graphql';
import { Status } from 'src/common/enums/status';

@ObjectType()
export class TicketStatusCount {
  @Field()
  status: Status;

  @Field()
  count: number;
}
