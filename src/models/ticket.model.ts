import { ObjectType } from '@nestjs/graphql';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';
import { BaseModel } from './base.model';
import { Category } from './category.model';
import { User } from './user.model';

@ObjectType()
export class Ticket extends BaseModel {
  createdBy: User;
  status: Status;
  title: string;
  body?: string;
  rating: number;
  feedback: string;
  started: boolean;
  priority?: Priority;
  categories: Category[];
  agents: User[];
  // checklistItems:
  followers: User[];
  // comments:
  // attachments:
}
