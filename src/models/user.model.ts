import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { UserRole } from './user-role.model';
import { UserGroup } from './user-group.model';
import { Ticket } from './ticket.model';
import { ChecklistItem } from './checklist-item.model';
import { TicketComment } from './ticket-comment.model';
import { TicketAttachment } from './ticket-attachment.model';
import { TicketAssignment } from './ticket-assigment.model';
import { TicketFollowing } from './ticket-following.model ';

@ObjectType()
export class User extends BaseModel {
  rcno: number;
  fullName: string;
  userId: string;
  email: string;
  password: string | null;
  roles?: UserRole[];
  userGroupUsers?: UserGroup[];
  ticketsCreated?: Ticket[];
  ticketAssignments?: TicketAssignment[];
  ticketFollowings?: TicketFollowing[];
  checklistCompletions?: ChecklistItem[];
  ticketComments?: TicketComment[];
  ticketAttachments?: TicketAttachment[];
  isSuperAdmin: boolean;
}
