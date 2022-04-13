import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { User } from './user.model';

@ObjectType()
export class TicketAttachment extends BaseModel {
  id: number;
  user?: User;
  description: string;
  mimeType?: string;
  originalName?: string;
  sharepointFileName?: string;
  mode: string;
}
