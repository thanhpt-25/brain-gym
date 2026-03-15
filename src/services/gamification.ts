import api from './api';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  bestScore?: number;
  avgScore?: number;
  totalExams?: number;
  questionsCreated?: number;
  examsCompleted?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  awardedAt?: string;
}

export const getLeaderboard = async (certificationId?: string, limit = 20): Promise<LeaderboardEntry[]> => {
  const params = new URLSearchParams();
  if (certificationId) params.append('certificationId', certificationId);
  params.append('limit', limit.toString());
  const response = await api.get<LeaderboardEntry[]>(`/leaderboard?${params}`);
  return response.data;
};

export const getBadges = async (): Promise<Badge[]> => {
  const response = await api.get<Badge[]>('/badges');
  return response.data;
};

export const getUserBadges = async (userId: string): Promise<Badge[]> => {
  const response = await api.get<Badge[]>(`/users/${userId}/badges`);
  return response.data;
};

export const getMyPoints = async (): Promise<{ points: number }> => {
  const response = await api.get<{ points: number }>('/me/points');
  return response.data;
};
