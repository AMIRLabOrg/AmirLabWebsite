import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DocumentKind } from '../../../generated/prisma/client';

export class DocumentApprovalDto {
  @IsUUID()
  approverPersonId!: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  removeSignature?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  removeWatermark?: boolean;
}

export class DocumentTemplateDto {
  @IsEnum(DocumentKind)
  kind!: DocumentKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  titleTemplate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  bodyMarkdown!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  emailSubjectTemplate!: string;

  @IsBoolean()
  isActive!: boolean;
}

export class IssueDocumentDto {
  @IsEnum(DocumentKind)
  kind!: DocumentKind;

  @IsUUID()
  templateId!: string;

  @IsOptional()
  @IsUUID()
  recipientPersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  positionTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  weeklyCommitment?: string;

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  letterSubject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  letterDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  certificateProgram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  certificateAchievement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  completionDate?: string;
}
