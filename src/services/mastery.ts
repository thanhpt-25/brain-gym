import api from "./api";

export interface DomainMastery {
  domainId: string;
  domainName: string;
  /** Accuracy 0-100 */
  accuracy: number;
  totalAnswered: number;
  totalCorrect: number;
  /** 0-1 fraction of domain questions with an active SRS card */
  srsCoverage: number;
  /** SRS cards due today or overdue */
  dueCount: number;
}

export interface MasteryData {
  certificationId: string;
  totalAttempts: number;
  /** true when fewer than 10 attempts exist */
  isEmpty: boolean;
  domains: DomainMastery[];
}

export async function getMastery(certificationId: string): Promise<MasteryData> {
  const response = await api.get<MasteryData>(
    `/mastery/${certificationId}`,
  );
  return response.data;
}
