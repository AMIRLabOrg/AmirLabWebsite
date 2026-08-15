import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AcademicRank, PlatformRole } from '../../../generated/prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEnum(PlatformRole)
  role: PlatformRole = PlatformRole.MEMBER;

  @IsOptional()
  @IsEnum(AcademicRank)
  // Permission role and academic rank are independent; staff may also publish.
  rank?: AcademicRank | null;
}
