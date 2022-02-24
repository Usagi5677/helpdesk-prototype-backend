import { ArgsType } from '@nestjs/graphql';
import { Priority } from 'src/common/enums/priority';
import { Status } from 'src/common/enums/status';
import ConnectionArgs from '../../common/pagination/connection-args';

@ArgsType()
export class TicketConnectionArgs extends ConnectionArgs {
  search?: string;
  status?: Status;
  createdById?: number;
  createdByUserId?: string;
  categoryIds?: number[];
  priority?: Priority;
  self?: boolean;
  from?: Date;
  to?: Date;
  assignedToId?: number;
}
