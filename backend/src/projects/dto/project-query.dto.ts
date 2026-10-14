import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProjectQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @IsIn(['active', 'completed', 'archived', 'all'])
  view: 'active' | 'completed' | 'archived' | 'all' = 'active';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsIn(['tasks', 'updates', 'changeRequests'])
  section: 'tasks' | 'updates' | 'changeRequests' = 'tasks';
}
