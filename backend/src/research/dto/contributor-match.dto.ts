import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ContributorMatchStatus } from '../../../generated/prisma/client';

export class ClaimContributorDto {
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  evidenceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}

export class LinkContributorDto {
  @IsUUID()
  personId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}

export class ReviewContributorMatchDto {
  @IsEnum(ContributorMatchStatus)
  status!: ContributorMatchStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;
}
