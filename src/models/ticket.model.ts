import { ObjectType } from '@nestjs/graphql';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';
import { BaseModel } from './base.model';
import { Category } from './category.model';
import { ChecklistItem } from './checklist-item.model';
import { Site } from './site.model';
import { User } from './user.model';

@ObjectType()
export class Ticket extends BaseModel {
  createdBy: User;
  status: Status;
  statusChangedAt?: Date;
  title: string;
  body?: string;
  rating?: number;
  feedback?: string;
  started: boolean;
  priority?: Priority;
  categories: Category[];
  agents: User[];
  ownerId?: number;
  checklistItems: ChecklistItem[];
  followers: User[];
  site: Site;
}
