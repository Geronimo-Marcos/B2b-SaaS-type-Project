import { Module } from "@nestjs/common";
import { MembershipsModule } from "../memberships/memberships.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { StorageService } from "./storage.service";

@Module({
  imports: [MembershipsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService],
})
export class DocumentsModule {}
