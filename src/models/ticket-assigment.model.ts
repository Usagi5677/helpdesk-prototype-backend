import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { User } from './user.model';
import { Ticket } from './ticket.model';

@ObjectType()
export class TicketAssignment extends BaseModel {
  userId: number;
  user: User;
  ticketId: number;
  ticket: Ticket;
  isOwner: boolean;
}
