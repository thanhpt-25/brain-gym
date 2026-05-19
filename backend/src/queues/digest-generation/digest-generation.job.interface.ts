export const DIGEST_GENERATION_QUEUE = 'DIGEST_GENERATION';

export interface DigestGenerationJobData {
  userId: string;
  weekStartDate: string; // ISO 8601 date string
}

export interface DigestGenerationJobResult {
  userId: string;
  emailSent: boolean;
  digestId: string;
  insightCount: number;
  emailAddress: string;
  sentAt: string; // ISO 8601 timestamp
}
