export const COACH_SESSION_MONITORING_QUEUE = 'COACH_SESSION_MONITORING';

export interface CoachSessionMonitoringJobData {
  sessionId: string;
  userId: string;
  costUsd: number;
}

export interface CoachSessionMonitoringJobResult {
  sessionId: string;
  userId: string;
  costTracked: boolean;
  costUsd: number;
  totalUserCostToday: number;
  rateLimitExceeded: boolean;
  alertTriggered: boolean;
}
