import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { documents, type Database } from "@smartdocs/db";
import { asc, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { MembershipsService } from "../memberships/memberships.service";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import { StorageService } from "./storage.service";

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly membershipsService: MembershipsService,
    private readonly storageService: StorageService,
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
