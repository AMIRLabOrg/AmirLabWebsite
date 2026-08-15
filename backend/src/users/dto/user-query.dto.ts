import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  AcademicRank,
  AccountStatus,
  PlatformRole,
} from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum UserSort {
  NAME = 'NAME',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @IsEnum(AcademicRank)
  rank?: AcademicRank;

  @IsOptional()
  @IsEnum(UserSort)
  sort: UserSort = UserSort.NEWEST;
}
