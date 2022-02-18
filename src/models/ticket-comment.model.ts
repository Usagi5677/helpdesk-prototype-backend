import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { User } from './user.model';

@ObjectType()
export class TicketComment extends BaseModel {
  user?: User;
  body: string;
  mode: string;
}
