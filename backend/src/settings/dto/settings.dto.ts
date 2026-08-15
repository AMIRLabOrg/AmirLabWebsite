import { IsIn, IsInt, Min } from 'class-validator';
import type {
  RankPolicy,
  VerificationMode,
  VerificationPolicy,
} from '../settings.service';

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
