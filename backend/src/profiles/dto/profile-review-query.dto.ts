import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum ProfileReviewSort {
  NAME = 'NAME',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class ProfileReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProfileReviewSort)
  sort: ProfileReviewSort = ProfileReviewSort.OLDEST;
}
