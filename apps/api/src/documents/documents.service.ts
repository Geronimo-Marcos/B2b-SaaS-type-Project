import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { documentJobs, documents, type Database } from "@smartdocs/db";
import { and, asc, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { MembershipsService } from "../memberships/memberships.service";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import { StorageService } from "./storage.service";
import { DocumentQueueService } from "./document-queue.service";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly membershipsService: MembershipsService,
    private readonly storageService: StorageService,
    private readonly documentQueueService: DocumentQueueService,
  ) {}

  async create(input: CreateDocumentDto, userId: string) {
    await this.membershipsService.assertMember(userId, input.organizationId, "editor");
    const documentId = randomUUID();
    const storageKey = `organizations/${input.organizationId}/documents/${documentId}`;
    const uploadUrl = await this.storageService.createUploadUrl(
      storageKey,
      input.mimeType?.trim(),
    );

    const [document] = await this.database.db
      .insert(documents)
      .values({
        id: documentId,
        organizationId: input.organizationId,
        uploadedBy: userId,
        title: input.title.trim(),
        originalName: input.originalName.trim(),
        storageKey,
        mimeType: input.mimeType?.trim(),
        fileSizeBytes: input.fileSizeBytes,
      })
      .returning();

    return { document, uploadUrl, uploadUrlExpiresInSeconds: 900 };
  }

  async confirmUpload(documentId: string, userId: string) {
    const [document] = await this.database.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.membershipsService.assertMember(userId, document.organizationId, "editor");
    if (document.status !== "uploaded") {
      throw new ConflictException("The document upload has already been confirmed");
    }

    const [job] = await this.database.db.transaction(async (transaction) => {
      const [updatedDocument] = await transaction
        .update(documents)
        .set({ status: "queued", updatedAt: new Date() })
        .where(and(eq(documents.id, documentId), eq(documents.status, "uploaded")))
        .returning();

      if (!updatedDocument) {
        throw new ConflictException("The document upload has already been confirmed");
      }

      return transaction
        .insert(documentJobs)
        .values({ documentId, jobType: "process-document" })
        .returning();
    });

    try {
      await this.documentQueueService.addProcessingJob(documentId, job.id);
    } catch (error) {
      await this.database.db
        .update(documentJobs)
        .set({
          status: "failed",
          errorMessage: "Unable to enqueue document processing",
          updatedAt: new Date(),
        })
        .where(eq(documentJobs.id, job.id));
      await this.database.db
        .update(documents)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(documents.id, documentId));
      throw new ServiceUnavailableException("Document processing queue is unavailable");
    }

    return { documentId, jobId: job.id, status: "queued" as const };
  }

  async findByOrganization(organizationId: string, userId: string) {
    await this.membershipsService.assertMember(userId, organizationId);

    return this.database.db
      .select()
      .from(documents)
      .where(eq(documents.organizationId, organizationId))
      .orderBy(asc(documents.createdAt));
  }

  async findOne(documentId: string, userId: string) {
    const [document] = await this.database.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.membershipsService.assertMember(userId, document.organizationId);
    return document;
  }
}
