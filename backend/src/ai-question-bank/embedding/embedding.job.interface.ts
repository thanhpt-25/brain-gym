export const EMBEDDING_QUEUE = 'embedding';

export interface EmbeddingJobData {
  questionId: string;
  text: string; // combined title + description + choices text
  modelId: string;
}

export interface EmbeddingBackfillJobData {
  batchOffset: number;
  batchSize: number;
}
