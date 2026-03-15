export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  avatarUrl?: string;
  certCode: string;
  certId: string;
  icon: string;
  bestScore: number;
  totalExams: number;
  avgScore: number;
  streak: number;
}

export const leaderboardData: LeaderboardEntry[] = [
  { id: '1', rank: 1, displayName: 'Minh Trí', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 96, totalExams: 12, avgScore: 91, streak: 7 },
  { id: '2', rank: 2, displayName: 'Thanh Hà', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 94, totalExams: 8, avgScore: 88, streak: 5 },
  { id: '3', rank: 3, displayName: 'Đức Anh', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 92, totalExams: 15, avgScore: 85, streak: 3 },
  { id: '4', rank: 4, displayName: 'Phương Linh', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 90, totalExams: 6, avgScore: 84, streak: 4 },
  { id: '5', rank: 5, displayName: 'Hoàng Nam', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 88, totalExams: 10, avgScore: 82, streak: 2 },
  { id: '6', rank: 6, displayName: 'Khánh Vy', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 85, totalExams: 4, avgScore: 80, streak: 1 },
  { id: '7', rank: 7, displayName: 'Tuấn Kiệt', certCode: 'SAA-C03', certId: 'aws-saa', icon: '☁️', bestScore: 83, totalExams: 9, avgScore: 78, streak: 2 },
  { id: '8', rank: 1, displayName: 'Minh Trí', certCode: 'AZ-900', certId: 'azure-az900', icon: '🔷', bestScore: 98, totalExams: 5, avgScore: 93, streak: 5 },
  { id: '9', rank: 2, displayName: 'Bảo Ngọc', certCode: 'AZ-900', certId: 'azure-az900', icon: '🔷', bestScore: 95, totalExams: 7, avgScore: 90, streak: 4 },
  { id: '10', rank: 3, displayName: 'Thanh Hà', certCode: 'AZ-900', certId: 'azure-az900', icon: '🔷', bestScore: 91, totalExams: 3, avgScore: 87, streak: 3 },
  { id: '11', rank: 4, displayName: 'Quốc Bảo', certCode: 'AZ-900', certId: 'azure-az900', icon: '🔷', bestScore: 89, totalExams: 6, avgScore: 83, streak: 2 },
  { id: '12', rank: 5, displayName: 'Hải Yến', certCode: 'AZ-900', certId: 'azure-az900', icon: '🔷', bestScore: 86, totalExams: 4, avgScore: 81, streak: 1 },
];
