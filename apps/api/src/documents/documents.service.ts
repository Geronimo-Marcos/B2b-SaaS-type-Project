import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { documentJobs, documents, type Database } from "@smartdocs/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { MembershipsService } from "../memberships/memberships.service";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import { StorageService } from "./storage.service";
import { DocumentQueueService } from "./document-queue.service";
import OpenAI from "openai";
import type { ChatDocumentDto } from "./dto/chat-document.dto";

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

  async chat(documentId: string, input: ChatDocumentDto, userId: string) {
    const [document] = await this.database.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.membershipsService.assertMember(userId, document.organizationId);
    if (document.status !== "processed") {
      throw new ConflictException("Document is not ready for chat");
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("OPENAI_API_KEY is not configured");
    }

    const embeddingModel =
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
    const chatModel = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
    const openai = new OpenAI({ apiKey });

    const questionEmbedding = await openai.embeddings.create({
      model: embeddingModel,
      input: input.question,
    });
    const vector = questionEmbedding.data[0]?.embedding;
    if (!vector || vector.length !== 1536) {
      throw new ServiceUnavailableException("Could not generate a valid query embedding");
    }

    const vectorLiteral = `[${vector.join(",")}]`;
    const matches = await this.database.db.execute<{
      chunk_index: number;
      content: string;
      distance: number;
    }>(sql`
      SELECT dc.chunk_index, dc.content,
             de.embedding <=> ${vectorLiteral}::vector AS distance
      FROM document_chunks dc
      INNER JOIN document_embeddings de ON de.chunk_id = dc.id
      WHERE dc.document_id = ${documentId}::uuid
      ORDER BY de.embedding <=> ${vectorLiteral}::vector
      LIMIT 6
    `);

    const sources = matches.rows.map((row) => ({
      chunkIndex: Number(row.chunk_index),
      distance: Number(row.distance),
      content: row.content,
    }));

    if (sources.length === 0) {
      return {
        answer: "I could not find relevant context in this document.",
        sources: [],
      };
    }

    const context = sources
      .map((source, index) => `[Source ${index + 1}, chunk ${source.chunkIndex}]\n${source.content}`)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Answer the user's question using only the provided document context. " +
            "If the context does not contain the answer, say that it is not in the document. " +
            "Do not invent facts or cite sources that are not in the context.",
        },
        {
          role: "user",
          content: `Document context:\n\n${context}\n\nQuestion:\n${input.question}`,
        },
      ],
    });

    return {
      answer: completion.choices[0]?.message.content?.trim() ??
        "I could not generate an answer.",
      sources: sources.map(({ chunkIndex, distance }) => ({ chunkIndex, distance })),
    };
  }

  async getProcessingStatus(documentId: string, userId: string) {
    const [document] = await this.database.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.membershipsService.assertMember(userId, document.organizationId);

    const [job] = await this.database.db
      .select({
        id: documentJobs.id,
        status: documentJobs.status,
        progress: documentJobs.progress,
        errorMessage: documentJobs.errorMessage,
        updatedAt: documentJobs.updatedAt,
      })
      .from(documentJobs)
      .where(eq(documentJobs.documentId, documentId))
      .orderBy(desc(documentJobs.createdAt))
      .limit(1);

    return {
      documentId,
      documentStatus: document.status,
      jobId: job?.id ?? null,
      jobStatus: job?.status ?? null,
      progress: job?.progress ?? 0,
      errorMessage: job?.errorMessage ?? null,
      updatedAt: job?.updatedAt ?? document.updatedAt,
    };
  }
}
