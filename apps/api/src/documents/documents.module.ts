import { Module } from "@nestjs/common";
import { MembershipsModule } from "../memberships/memberships.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { StorageService } from "./storage.service";
import { DocumentQueueService } from "./document-queue.service";

@Module({
  imports: [MembershipsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, DocumentQueueService],
})
export class DocumentsModule {}
