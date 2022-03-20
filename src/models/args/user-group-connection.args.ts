import { ArgsType } from '@nestjs/graphql';
import ConnectionArgs from '../../common/pagination/connection-args';

@ArgsType()
export class UserGroupConnectionArgs extends ConnectionArgs {
  name?: string;
  siteId: number;
}
