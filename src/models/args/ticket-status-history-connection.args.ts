import { ArgsType } from '@nestjs/graphql';
import { Status } from 'src/common/enums/status';

@ArgsType()
export class TicketStatusHistoryConnectionArgs {
  statuses?: Status[];
  from: Date;
  to: Date;
  siteId?: number;
}
