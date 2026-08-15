import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PersonLinkType,
  PersonSectionType,
  ProfileReviewStatus,
} from '../../../generated/prisma/client';

export class SubmitProfileEditDto {
  @IsString()
  @MaxLength(100_000)
  profile!: string;

  @IsOptional()
  @IsBooleanString()
  removeAvatar?: string;

  @IsOptional()
  @IsBooleanString()
  publishNow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class ReviewProfileEditDto {
  @IsEnum(ProfileReviewStatus)
  status!: ProfileReviewStatus;

  @IsInt()
  @Min(1)
  revision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  note?: string;
}

export interface ProfileEditPayload {
  fullName: string;
  headline: string | null;
  biography: string | null;
  publicEmail: string | null;
  phone: string | null;
  contactAddress: string | null;
  roleTitle?: string | null;
  expertise: string[];
  links: Array<{ type: PersonLinkType; label: string; url: string }>;
  sections: Array<{
    type: PersonSectionType;
    title: string;
    subsections: Array<{
      heading: string | null;
      entries: string[];
    }>;
  }>;
  removeAvatar: boolean;
}
