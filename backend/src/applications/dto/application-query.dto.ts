import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApplicationStatus } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum ApplicationSort {
  NAME = 'NAME',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class ApplicationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    ApplicationStatus.PARSING,
    ApplicationStatus.PARSE_FAILED,
    ApplicationStatus.NEEDS_REVIEW,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ])
  status?: ApplicationStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(ApplicationSort)
  sort: ApplicationSort = ApplicationSort.NEWEST;
}
