import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum ResearchLibraryView {
  CURRENT = 'current',
  ISSUES = 'issues',
  RETAINED = 'retained',
}

export class ResearchLibraryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @IsOptional()
  @IsIn(['PAPER', 'DATASET'])
  type?: 'PAPER' | 'DATASET';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ResearchLibraryView)
  view = ResearchLibraryView.CURRENT;
}
