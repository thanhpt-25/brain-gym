import api from "./api";

export type IngestionJobStatus =
  | "PENDING"
  | "EXTRACTING"
  | "ENRICHING"
  | "COMPLETED"
  | "FAILED";

export interface IngestionJob {
  id: string;
  userId: string;
  certificationId: string;
  fileName: string;
  fileSizeBytes: number;
  status: IngestionJobStatus;
  extractedCount: number | null;
  enrichedCount: number | null;
  skippedCount: number | null;
  estimatedCostUsd: number | null;
  rightsAttestation: boolean;
  declaredSource: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  _count?: { questions: number };
}

export interface IngestionEstimate {
  wordCount: number;
  estimatedPages: number;
  estimatedCostUsd: number;
  certificationId: string;
}

const base = "/admin/ingestion";

export const estimateIngestion = async (
  file: File,
  certificationId: string,
): Promise<IngestionEstimate> => {
  const form = new FormData();
  form.append("file", file);
  form.append("certificationId", certificationId);
  const res = await api.post<IngestionEstimate>(`${base}/estimate`, form);
  return res.data;
};

export const createIngestionJob = async (
  file: File,
  certificationId: string,
  rightsAttestation: boolean,
  declaredSource?: string,
): Promise<IngestionJob> => {
  const form = new FormData();
  form.append("file", file);
  form.append("certificationId", certificationId);
  form.append("rightsAttestation", String(rightsAttestation));
  if (declaredSource) form.append("declaredSource", declaredSource);
  const res = await api.post<IngestionJob>(`${base}/jobs`, form);
  return res.data;
};

export const listIngestionJobs = async (
  page = 1,
  limit = 20,
): Promise<{
  data: IngestionJob[];
  total: number;
  page: number;
  limit: number;
}> => {
  const res = await api.get(`${base}/jobs?page=${page}&limit=${limit}`);
  return res.data;
};

export const getIngestionJob = async (jobId: string): Promise<IngestionJob> => {
  const res = await api.get<IngestionJob>(`${base}/jobs/${jobId}`);
  return res.data;
};
