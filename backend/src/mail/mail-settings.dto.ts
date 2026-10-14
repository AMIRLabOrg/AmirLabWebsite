import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class MailSettingsDto {
  @IsIn(['SMTP', 'RESEND'])
  provider!: 'SMTP' | 'RESEND';

  @IsString()
  @MaxLength(254)
  @Matches(/^[^\r\n]+$/)
  from!: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-zA-Z0-9.-]*$/)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsBoolean()
  requireTls?: boolean;

  @IsOptional()
  @IsBoolean()
  clearSecret?: boolean;
}

export class MailTestDto {
  @IsEmail()
  to!: string;
}
