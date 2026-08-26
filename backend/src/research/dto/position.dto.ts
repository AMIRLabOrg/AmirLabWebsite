import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  AcademicRank,
  EngagementType,
  PositionType,
} from '../../../generated/prisma/client';

export class CreatePositionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(8_000)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  responsibilities?: string[];

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  requirements!: string[];

  @IsOptional()
  @IsEnum(PositionType)
  positionType?: PositionType;

  @IsOptional()
  @IsEnum(AcademicRank)
  targetRank?: AcademicRank;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsEnum(EngagementType)
  engagementType?: EngagementType;

  @IsOptional()
  @IsDateString()
  engagementStartsAt?: string;

  @IsOptional()
  @IsDateString()
  engagementEndsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  engagementDurationLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  weeklyCommitmentHours?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(8_000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsEnum(PositionType)
  positionType?: PositionType;

  @IsOptional()
  @IsEnum(AcademicRank)
  targetRank?: AcademicRank;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsEnum(EngagementType)
  engagementType?: EngagementType;

  @IsOptional()
  @IsDateString()
  engagementStartsAt?: string;

  @IsOptional()
  @IsDateString()
  engagementEndsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  engagementDurationLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  weeklyCommitmentHours?: number;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
