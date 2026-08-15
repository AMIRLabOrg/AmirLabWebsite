import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DepartmentRole } from '../../../generated/prisma/client';

export class DepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string | null;

  @IsBoolean()
  isPublished = false;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class DepartmentMembershipDto {
  @IsUUID()
  personId!: string;

  @IsEnum(DepartmentRole)
  role: DepartmentRole = DepartmentRole.MEMBER;

  @IsBoolean()
  isPrimary = false;

  @IsInt()
  @Min(0)
  sortOrder = 0;
}
