import { ObjectType } from '@nestjs/graphql';
import RelayTypes from '../../common/pagination/relay-types';
import { Category } from '../category.model';

@ObjectType()
export class PaginatedCategory extends RelayTypes<Category>(Category) {}
