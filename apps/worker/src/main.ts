import { Worker } from "bullmq";
import {
  createDatabase,
  documentChunks,
  documentEmbeddings,
  documentJobs,
  documents,
} from "@smartdocs/db";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";

const databaseUrl = process.env.DATABASE_URL?.trim();
const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the worker");
}

const database = createDatabase(databaseUrl);

function createEmbeddingClient(): { client: OpenAI; model: string } {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  };
}

async function generateEmbeddings(
  chunks: Array<{ id: string; content: string }>,
  client: OpenAI,
  model: string,
) {
  const embeddings: Array<{ chunkId: string; embedding: number[]; modelName: string }> = [];

  for (let offset = 0; offset < chunks.length; offset += 100) {
    const batch = chunks.slice(offset, offset + 100);
    const response = await client.embeddings.create({
      model,
      input: batch.map((chunk) => chunk.content),
    });

    if (response.data.length !== batch.length) {
      throw new Error(
        `Embedding API returned ${response.data.length} vectors for ${batch.length} chunks`,
      );
    }

    for (let index = 0; index < response.data.length; index += 1) {
      const embedding = response.data[index].embedding;
      if (embedding.length !== 1536) {
        throw new Error(`Embedding returned ${embedding.length} dimensions instead of 1536`);
      }
      embeddings.push({
        chunkId: batch[index].id,
        embedding,
        modelName: model,
      });
    }
  }

  return embeddings;
}

function createStorageClient(): { client: S3Client; bucket: string } {
  const region = process.env.S3_REGION?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required",
    );
  }

  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function processDocument(documentId: string, jobId: string, updateProgress: (progress: number) => Promise<void>) {
  const [document] = await database.db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!document) {
    throw new Error("Document not found");
  }

  if (document.mimeType !== "application/pdf") {
    throw new Error("Only application/pdf documents are supported");
  }

  const storage = createStorageClient();
  const object = await storage.client.send(
    new GetObjectCommand({ Bucket: storage.bucket, Key: document.storageKey }),
  );
  if (!object.Body) {
    throw new Error("Stored document has no content");
  }

  const bytes = await object.Body.transformToByteArray();
  await updateProgress(30);

  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (!text) {
      throw new Error("PDF contains no extractable text");
    }

    await updateProgress(65);
    const chunkSize = 4000;
    const chunks: Array<{
      documentId: string;
      chunkIndex: number;
      content: string;
      tokenCount: number;
    }> = [];
    for (let offset = 0, index = 0; offset < text.length; offset += chunkSize, index += 1) {
      chunks.push({
        documentId,
        chunkIndex: index,
        content: text.slice(offset, offset + chunkSize),
        tokenCount: Math.ceil(text.slice(offset, offset + chunkSize).length / 4),
      });
    }

    const insertedChunks = await database.db.transaction(async (transaction) => {
      await transaction.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
      return transaction
        .insert(documentChunks)
        .values(chunks)
        .returning({ id: documentChunks.id, content: documentChunks.content });
    });

    await updateProgress(70);
    const embedding = createEmbeddingClient();
    const embeddings = await generateEmbeddings(insertedChunks, embedding.client, embedding.model);
    await updateProgress(80);

    await database.db.insert(documentEmbeddings).values(embeddings);

    const extractedKey = `${document.storageKey}/extracted.txt`;
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: extractedKey,
        Body: text,
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    await updateProgress(90);

    await database.db
      .update(documents)
      .set({
        status: "processed",
        extractedTextPath: extractedKey,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    await database.db
      .update(documentJobs)
      .set({
        status: "succeeded",
        progress: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentJobs.id, jobId));
  } finally {
    await parser.destroy();
  }
}

const worker = new Worker<{ documentId: string; jobId: string }>(
  "document-processing",
  async (job) => {
    const now = new Date();
    await database.db
      .update(documentJobs)
      .set({ status: "running", progress: 10, startedAt: now, updatedAt: now })
      .where(eq(documentJobs.id, job.data.jobId));
    await database.db
      .update(documents)
      .set({ status: "processing", updatedAt: now })
      .where(eq(documents.id, job.data.documentId));

    try {
      await processDocument(job.data.documentId, job.data.jobId, async (progress) => {
        await database.db
          .update(documentJobs)
          .set({ progress, updatedAt: new Date() })
          .where(eq(documentJobs.id, job.data.jobId));
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Document processing failed";
      await database.db
        .update(documentJobs)
        .set({
          status: "failed",
          errorMessage,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documentJobs.id, job.data.jobId));
      await database.db
        .update(documents)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(documents.id, job.data.documentId));
      throw error;
    }
  },
  { connection: { url: redisUrl }, concurrency: 2 },
);

worker.on("completed", (job) => {
  console.log(`Document job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Document job failed: ${job?.id ?? "unknown"}`, error);
});

console.log("SmartDocs document worker started");
