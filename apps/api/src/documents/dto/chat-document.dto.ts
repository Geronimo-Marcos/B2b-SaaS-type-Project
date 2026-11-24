import { IsString, MaxLength, MinLength } from "class-validator";

export class ChatDocumentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  question!: string;
}
