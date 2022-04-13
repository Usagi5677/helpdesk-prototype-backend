import { ArgsType } from '@nestjs/graphql';
import ConnectionArgs from '../../common/pagination/connection-args';

@ArgsType()
export class KnowledgebaseConnectionArgs extends ConnectionArgs {
  search?: string;
  createdById?: number;
  siteId?: number;
}
