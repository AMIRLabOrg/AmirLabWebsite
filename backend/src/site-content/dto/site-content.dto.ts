import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class HomeContentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(180)
  establishment!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(180)
  heroTitle!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(800)
  heroIntroduction!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  primaryCtaLabel!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  secondaryCtaLabel!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  latestEyebrow!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(140)
  latestTitle!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  recruitmentEyebrow!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(140)
  recruitmentTitle!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(600)
  recruitmentBody!: string;
}

export class AboutFactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  value!: string;
}

export class AboutContentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  eyebrow!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(220)
  title!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(1_200)
  introduction!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  missionTitle!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(1_600)
  missionBody!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  focusTitle!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(100, { each: true })
  focusAreas!: string[];

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  organizationTitle!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(1_600)
  organizationBody!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => AboutFactDto)
  facts!: AboutFactDto[];

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  closingTitle!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(800)
  closingBody!: string;
}
