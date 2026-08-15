import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApplicationStatus } from '../../../generated/prisma/client';

export class SubmitApplicationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsUUID()
  positionId!: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  consent!: boolean;
}

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  reason?: string;
}
