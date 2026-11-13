import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { DOCUMENT_PROCESSING_QUEUE } from "./document-queue.constants";

@Injectable()
export class DocumentQueueService {
  private readonly queue: Queue;

  constructor(configService: ConfigService) {
    const connection = configService.get<string>("REDIS_URL")?.trim() || "redis://localhost:6379";
    this.queue = new Queue(DOCUMENT_PROCESSING_QUEUE, {
      connection: { url: connection },
    });
  }

  addProcessingJob(documentId: string, jobId: string) {
    return this.queue.add(
      "process-document",
      { documentId, jobId },
      { jobId, removeOnComplete: 100, removeOnFail: 100 },
    );
  }
}
