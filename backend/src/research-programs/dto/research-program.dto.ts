import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ResearchProgramStatus } from '../../../generated/prisma/client';

export class SaveResearchProgramDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  summary?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8_000)
  objective!: string;

  @IsEnum(ResearchProgramStatus)
  status!: ResearchProgramStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsBoolean()
  publicPageEnabled = false;

  @IsOptional()
  @IsUUID()
  leadPersonId?: string | null;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  departmentIds!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  projectIds!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  outputIds!: string[];
}
