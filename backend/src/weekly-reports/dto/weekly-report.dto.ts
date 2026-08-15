import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WeeklyReportStatus } from '../../../generated/prisma/client';

export class SaveWeeklyReportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(12_000)
  accomplishments!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  blockers?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12_000)
  nextWeekPlan!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  projectIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  outputIds?: string[];
}

export class ReviewWeeklyReportDto {
  @IsIn([WeeklyReportStatus.REVIEWED, WeeklyReportStatus.CHANGES_REQUESTED])
  status!:
    | typeof WeeklyReportStatus.REVIEWED
    | typeof WeeklyReportStatus.CHANGES_REQUESTED;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  note?: string;
}
