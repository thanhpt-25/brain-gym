import { Injectable, Logger } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageEngine } from 'multer';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface PresignResult {
  mode: 's3';
  uploadUrl: string;
  key: string;
  /** Full public URL after upload completes */
  publicUrl: string;
}

export interface LocalUploadResult {
  mode: 'local';
  /** URL the frontend should POST multipart/form-data to */
  uploadUrl: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  readonly isS3: boolean;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor() {
    this.bucket = process.env.AWS_S3_AVATARS_BUCKET ?? '';
    this.cdnBase = (process.env.AWS_AVATARS_CDN_BASE_URL ?? '').replace(
      /\/$/,
      '',
    );
    const region = process.env.AWS_REGION;

    if (this.bucket && region) {
      // Credentials come from the ECS task IAM role — no static keys needed.
      // Locally the SDK falls back to ~/.aws/credentials or env vars if set.
      this.s3 = new S3Client({ region });
      this.isS3 = true;
      this.logger.log(`Storage: S3 (bucket=${this.bucket}, region=${region})`);
    } else {
      this.s3 = null;
      this.isS3 = false;
      this.logger.log('Storage: local disk (uploads/avatars)');
    }
  }

  /** Generate a presigned PUT URL for direct browser → S3 upload (expires in 5 min). */
  async presignAvatarUpload(
    contentType: string,
  ): Promise<PresignResult | LocalUploadResult> {
    if (!this.isS3 || !this.s3) {
      return {
        mode: 'local',
        uploadUrl: '/api/v1/users/me/avatar/upload-local',
      };
    }

    const ext = contentType.split('/')[1] ?? 'jpg';
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const publicUrl = `${this.cdnBase}/${key}`;

    return { mode: 's3', uploadUrl, key, publicUrl };
  }

  /** Build the CloudFront public URL from a confirmed S3 key. */
  resolvePublicUrl(key: string): string {
    return `${this.cdnBase}/${key}`;
  }

  /** Disk storage engine for local-only uploads. */
  buildLocalDiskStorage(): StorageEngine {
    return diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'avatars');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    });
  }

  async deleteAvatar(avatarUrl: string): Promise<void> {
    if (!this.isS3 || !this.s3) return;
    if (!avatarUrl.includes(this.cdnBase)) return;

    const key = avatarUrl.replace(`${this.cdnBase}/`, '');
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object ${key}: ${err}`);
    }
  }
}
