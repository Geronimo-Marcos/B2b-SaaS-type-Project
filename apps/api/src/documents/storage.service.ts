import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  async createUploadUrl(storageKey: string, contentType: string | undefined) {
    const region = this.configService.get<string>("S3_REGION")?.trim();
    const bucket = this.configService.get<string>("S3_BUCKET")?.trim();
    const accessKeyId = this.configService.get<string>("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey = this.configService.get<string>("S3_SECRET_ACCESS_KEY")?.trim();
    const endpoint = this.configService.get<string>("S3_ENDPOINT")?.trim();

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required",
      );
    }

    const client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType || "application/octet-stream",
    });

    return getSignedUrl(client, command, { expiresIn: 900 });
  }
}
