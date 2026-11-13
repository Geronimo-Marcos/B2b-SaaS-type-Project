import { IsUUID } from "class-validator";

export class ConfirmDocumentUploadDto {
  @IsUUID()
  documentId!: string;
}
