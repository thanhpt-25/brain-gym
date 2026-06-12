import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
  readonly bucket = process.env.AWS_S3_MATERIALS_TMP_BUCKET ?? '';

  async uploadToTemp(buffer: Buffer, filename: string): Promise<{ bucket: string; key: string }> {
    const key = `uploads/${uuidv4()}/${filename}`;
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer }));
    return { bucket: this.bucket, key };
  }

  async deleteTemp(bucket: string, key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete temp s3://${bucket}/${key}: ${err}`);
    }
  }
}
