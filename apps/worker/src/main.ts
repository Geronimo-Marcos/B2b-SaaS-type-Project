import { Worker } from "bullmq";
import { documentJobs, documents, createDatabase } from "@smartdocs/db";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL?.trim();
const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the worker");
}

const database = createDatabase(databaseUrl);

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

    const errorMessage =
      "PDF extraction and embedding generation are not implemented yet";
    await database.db
      .update(documentJobs)
      .set({
        status: "failed",
        progress: 10,
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentJobs.id, job.data.jobId));
    await database.db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, job.data.documentId));

    throw new Error(errorMessage);
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
