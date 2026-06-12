export const MATERIAL_CONVERSION_QUEUE = 'material-conversion';

export interface MaterialConversionJobData {
  materialId: string;
  filename: string;
  // Production: Lambda reads from S3
  s3Bucket?: string;
  s3Key?: string;
  // Local dev: buffer embedded as base64 (no S3 needed)
  bufferBase64?: string;
}
