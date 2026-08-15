import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum NotificationReadFilter {
  ALL = 'ALL',
  READ = 'READ',
  UNREAD = 'UNREAD',
}

export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(NotificationReadFilter)
  read: NotificationReadFilter = NotificationReadFilter.ALL;
}
