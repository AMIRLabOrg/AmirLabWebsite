import { ArrayUnique, IsArray, IsUUID, ValidateIf } from 'class-validator';

export class FoundingMembersDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  founderId!: string | null;

  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  cofounderIds!: string[];
}
