import { ObjectType } from '@nestjs/graphql';
import RelayTypes from '../../common/pagination/relay-types';
import { Knowledgebase } from '../knowledgebase.model';

@ObjectType()
export class PaginatedKnowledgebase extends RelayTypes<Knowledgebase>(
  Knowledgebase
) {}
