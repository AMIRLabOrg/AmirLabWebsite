import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ResearchItemType,
  ReviewStatus,
} from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum ResearchReviewSort {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  TITLE = 'TITLE',
}

export class ResearchReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn([ResearchItemType.PAPER, ResearchItemType.DATASET])
  type?: ResearchItemType;

  @IsOptional()
  @IsIn([
    ReviewStatus.NEEDS_REVIEW,
    ReviewStatus.CHANGES_REQUESTED,
    ReviewStatus.PUBLISHED,
    ReviewStatus.REJECTED,
  ])
  status?: ReviewStatus;

  @IsOptional()
  @IsEnum(ResearchReviewSort)
  sort: ResearchReviewSort = ResearchReviewSort.OLDEST;
}
