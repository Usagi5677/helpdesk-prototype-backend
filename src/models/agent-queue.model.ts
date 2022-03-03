import { ObjectType } from '@nestjs/graphql';
import { Ticket } from './ticket.model';
import { User } from './user.model';

@ObjectType()
export class AgentQueue {
  agent: User;
  tickets: Ticket[];
}
