import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ProjectAccess,
  ProjectChangeStatus,
  ProjectMemberRole,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectUpdateStatus,
} from '../../../generated/prisma/client';

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  summary?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8_000)
  objective!: string;

  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsUUID()
  ownerPersonId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  contributorPersonIds!: string[];

  @IsEnum(ProjectStatus)
  status!: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

class OverrideDto {
  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class ProjectObjectiveDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;
}

export class UpdateProjectDto extends OverrideDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  objective?: string | null;

  @IsEnum(ProjectStatus)
  status!: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsBoolean()
  publicPageEnabled!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectObjectiveDto)
  objectives!: ProjectObjectiveDto[];
}

export class ProjectMilestoneDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number;

  @IsEnum(ProjectMilestoneStatus)
  status!: ProjectMilestoneStatus;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class CreateProjectTaskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectTaskStatus)
  status?: ProjectTaskStatus;

  @IsEnum(ProjectTaskPriority)
  priority!: ProjectTaskPriority;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class UpdateProjectTaskDto extends CreateProjectTaskDto {
  @IsEnum(ProjectTaskStatus)
  declare status: ProjectTaskStatus;
}

export class ReplaceMilestonesDto extends OverrideDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestones!: ProjectMilestoneDto[];
}

export class ProjectUpdateDto extends OverrideDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12_000)
  body!: string;

  @IsEnum(ProjectUpdateStatus)
  status!: ProjectUpdateStatus;

  @IsOptional()
  @IsUUID()
  milestoneId?: string | null;

  @IsOptional()
  @IsUUID()
  linkedOutputId?: string | null;
}

export class ProjectInvitationDto extends OverrideDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole = ProjectMemberRole.CONTRIBUTOR;

  @IsEnum(ProjectAccess)
  access: ProjectAccess = ProjectAccess.VIEW;
}

export class AcceptProjectInvitationDto {
  @IsString()
  @MinLength(20)
  token!: string;
}

export class ProjectOutputDto extends OverrideDto {
  @IsUUID()
  outputId!: string;
}

export class ProjectResourceDto extends OverrideDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  label!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  kind!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}

export class ArchiveProjectDto extends OverrideDto {}

export class ReviewProjectChangeDto {
  @IsEnum(ProjectChangeStatus)
  status!: ProjectChangeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  note?: string;
}

export class BulkReviewProjectChangesDto extends ReviewProjectChangeDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];
}
