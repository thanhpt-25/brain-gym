export interface ExamHistoryItem {
  id: string;
  certId: string;
  certName: string;
  certCode: string;
  icon: string;
  date: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  timeTaken: number; // minutes
  mode: 'exam' | 'study';
  domainResults: { domain: string; correct: number; total: number }[];
}

export const examHistory: ExamHistoryItem[] = [
  {
    id: 'h1', certId: 'aws-saa', certName: 'Solutions Architect Associate', certCode: 'SAA-C03', icon: '☁️',
    date: '2026-03-14', score: 52, total: 65, percentage: 80, passed: true, timeTaken: 105, mode: 'exam',
    domainResults: [
      { domain: 'Design Resilient Architectures', correct: 14, total: 17 },
      { domain: 'Design High-Performing Architectures', correct: 13, total: 16 },
      { domain: 'Design Secure Applications', correct: 12, total: 16 },
      { domain: 'Design Cost-Optimized Architectures', correct: 13, total: 16 },
    ],
  },
  {
    id: 'h2', certId: 'aws-saa', certName: 'Solutions Architect Associate', certCode: 'SAA-C03', icon: '☁️',
    date: '2026-03-12', score: 45, total: 65, percentage: 69, passed: false, timeTaken: 120, mode: 'exam',
    domainResults: [
      { domain: 'Design Resilient Architectures', correct: 12, total: 17 },
      { domain: 'Design High-Performing Architectures', correct: 11, total: 16 },
      { domain: 'Design Secure Applications', correct: 10, total: 16 },
      { domain: 'Design Cost-Optimized Architectures', correct: 12, total: 16 },
    ],
  },
  {
    id: 'h3', certId: 'aws-saa', certName: 'Solutions Architect Associate', certCode: 'SAA-C03', icon: '☁️',
    date: '2026-03-10', score: 40, total: 65, percentage: 62, passed: false, timeTaken: 125, mode: 'exam',
    domainResults: [
      { domain: 'Design Resilient Architectures', correct: 10, total: 17 },
      { domain: 'Design High-Performing Architectures', correct: 10, total: 16 },
      { domain: 'Design Secure Applications', correct: 9, total: 16 },
      { domain: 'Design Cost-Optimized Architectures', correct: 11, total: 16 },
    ],
  },
  {
    id: 'h4', certId: 'aws-saa', certName: 'Solutions Architect Associate', certCode: 'SAA-C03', icon: '☁️',
    date: '2026-03-08', score: 35, total: 65, percentage: 54, passed: false, timeTaken: 130, mode: 'exam',
    domainResults: [
      { domain: 'Design Resilient Architectures', correct: 9, total: 17 },
      { domain: 'Design High-Performing Architectures', correct: 9, total: 16 },
      { domain: 'Design Secure Applications', correct: 8, total: 16 },
      { domain: 'Design Cost-Optimized Architectures', correct: 9, total: 16 },
    ],
  },
  {
    id: 'h5', certId: 'az-900', certName: 'Azure Fundamentals', certCode: 'AZ-900', icon: '🔷',
    date: '2026-03-13', score: 38, total: 45, percentage: 84, passed: true, timeTaken: 55, mode: 'exam',
    domainResults: [
      { domain: 'Cloud Concepts', correct: 10, total: 11 },
      { domain: 'Azure Architecture', correct: 10, total: 12 },
      { domain: 'Azure Services', correct: 9, total: 11 },
      { domain: 'Security & Compliance', correct: 9, total: 11 },
    ],
  },
  {
    id: 'h6', certId: 'az-900', certName: 'Azure Fundamentals', certCode: 'AZ-900', icon: '🔷',
    date: '2026-03-09', score: 30, total: 45, percentage: 67, passed: false, timeTaken: 70, mode: 'exam',
    domainResults: [
      { domain: 'Cloud Concepts', correct: 8, total: 11 },
      { domain: 'Azure Architecture', correct: 7, total: 12 },
      { domain: 'Azure Services', correct: 8, total: 11 },
      { domain: 'Security & Compliance', correct: 7, total: 11 },
    ],
  },
  {
    id: 'h7', certId: 'aws-saa', certName: 'Solutions Architect Associate', certCode: 'SAA-C03', icon: '☁️',
    date: '2026-03-14', score: 8, total: 10, percentage: 80, passed: true, timeTaken: 15, mode: 'study',
    domainResults: [
      { domain: 'Design Secure Applications', correct: 4, total: 5 },
      { domain: 'Design Resilient Architectures', correct: 4, total: 5 },
    ],
  },
];
