import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
} from "@nestjs/common";
import { interval, from, distinctUntilChanged, map, startWith, switchMap, takeWhile } from "rxjs";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { ConfirmDocumentUploadDto } from "./dto/confirm-document-upload.dto";
import { DocumentsService } from "./documents.service";
import { ChatDocumentDto } from "./dto/chat-document.dto";

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

  @Post(":documentId/chat")
  chat(
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() input: ChatDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.chat(documentId, input, user.sub);
  }

  @Sse(":documentId/progress")
  progress(
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.documentsService.getProcessingStatus(documentId, user.sub))),
      map((status) => ({ data: status })),
      distinctUntilChanged(
        (previous, current) =>
          JSON.stringify(previous.data) === JSON.stringify(current.data),
      ),
      takeWhile(
        (event) =>
          event.data.documentStatus !== "processed" &&
          event.data.documentStatus !== "failed",
        true,
      ),
    );
  }
}
