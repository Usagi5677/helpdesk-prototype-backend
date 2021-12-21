import { ArgsType } from '@nestjs/graphql';
import ConnectionArgs from '../../common/pagination/connection-args';

@ArgsType()
export class CategoryConnectionArgs extends ConnectionArgs {
  name?: string;
}
