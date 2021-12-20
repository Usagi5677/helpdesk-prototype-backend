import { ArgsType, Field, Int } from '@nestjs/graphql';
import ConnectionArgs from '../../common/pagination/connection-args';

@ArgsType()
export class UserGroupConnectionArgs extends ConnectionArgs {
  @Field(() => Int)
  name?: string;
}
