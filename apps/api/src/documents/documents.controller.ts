import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { ConfirmDocumentUploadDto } from "./dto/confirm-document-upload.dto";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() input: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(input, user.sub);
  }

  @Post("confirm-upload")
  confirmUpload(
    @Body() input: ConfirmDocumentUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.confirmUpload(input.documentId, user.sub);
  }

  @Get("organization/:organizationId")
  findByOrganization(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.findByOrganization(organizationId, user.sub);
  }

  @Get(":documentId")
  findOne(
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.findOne(documentId, user.sub);
  }
}
