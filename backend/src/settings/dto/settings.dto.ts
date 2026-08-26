import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  AppointmentLetterTemplate,
  NotificationPolicy,
  RankPolicy,
  VerificationMode,
  VerificationPolicy,
} from '../settings.service';

export class AppointmentLetterTemplateDto implements Omit<
  AppointmentLetterTemplate,
  'version'
> {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  markdown!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^<>{}\r\n\t]+$/)
  @MaxLength(160)
  signerName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^<>{}\r\n\t]+$/)
  @MaxLength(160)
  signerTitle!: string;

  @IsEmail()
  signerEmail!: string;

  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,40}$/)
  @MaxLength(40)
  signerPhone!: string;

  @IsUrl({ require_protocol: true })
  @Matches(/^https:\/\//i, { message: 'siteUrl must use HTTPS' })
  siteUrl!: string;

  @IsEmail()
  siteEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^<>{}\r\n\t]+$/)
  @MaxLength(240)
  siteLocation!: string;
}

export class NotificationPolicyDto implements NotificationPolicy {
  @IsBoolean()
  applicationAccepted!: boolean;

  @IsBoolean()
  applicationRejected!: boolean;

  @IsBoolean()
  taskAssigned!: boolean;

  @IsBoolean()
  taskChanged!: boolean;

  @IsBoolean()
  milestoneProgress!: boolean;

  @IsBoolean()
  deadlineReminder!: boolean;

  @IsBoolean()
  deadlineDue!: boolean;

  @IsBoolean()
  deadlineOverdue!: boolean;

  @IsInt()
  @Min(0)
  @Max(30)
  reminderDays!: number;
}

export class VerificationPolicyDto implements VerificationPolicy {
  @IsIn(['AUTOMATIC', 'MANUAL'])
  profileEdit!: VerificationMode;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  newPaper!: VerificationMode;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  newDataset!: VerificationMode;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  newProject!: VerificationMode;

  @IsIn(['AUTOMATIC', 'MANUAL'])
  updateProject!: VerificationMode;
}

export class RankPolicyDto implements RankPolicy {
  @IsInt()
  @Min(0)
  seniorPaperMinimum!: number;

  @IsInt()
  @Min(0)
  seniorCitationMinimum!: number;

  @IsInt()
  @Min(0)
  leadPaperMinimum!: number;

  @IsInt()
  @Min(0)
  leadCitationMinimum!: number;
}
