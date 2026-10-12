import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import type { BackupProvider } from './backup-storage';
export class BackupSettingsDto {
  @IsOptional() @IsIn(['local', 's3', 'sftp']) provider?: BackupProvider;
  @IsOptional() @IsString() @MaxLength(500) directory?: string;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(10080) intervalMinutes!: number;
  @IsOptional() @IsString() @MaxLength(2000) bucket?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(2000) endpoint?: string;
  @IsOptional() @IsString() @MaxLength(2000) prefix?: string;
  @IsOptional() @IsBoolean() forcePathStyle?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) accessKeyId?: string;
  @IsOptional() @IsString() @MaxLength(2000) secretAccessKey?: string;
  @IsOptional() @IsString() @MaxLength(253) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(100) username?: string;
  @IsOptional() @IsString() @MaxLength(2000) remoteDirectory?: string;
  @IsOptional() @IsString() @MaxLength(2000) hostKey?: string;
  @IsOptional() @IsIn(['privateKey', 'password']) authentication?:
    'privateKey' | 'password';
  @IsOptional() @IsString() @MaxLength(20000) privateKey?: string;
  @IsOptional() @IsString() @MaxLength(2000) password?: string;
}
