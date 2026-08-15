import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PublicationCategory } from '../publication-category';

export enum PublicationSort {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  TITLE = 'TITLE',
}

export class PublicationQueryDto extends PaginationQueryDto {
  pageSize = 12;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(PublicationCategory)
  category?: PublicationCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;

  @IsOptional()
  @IsEnum(PublicationSort)
  sort: PublicationSort = PublicationSort.NEWEST;
}
