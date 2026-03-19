import { Certification } from '@/types/exam';

export const fallbackCertifications: Certification[] = [
  {
    id: 'fallback-aws-saa',
    code: 'SAA-C03',
    name: 'AWS Solutions Architect Associate',
    provider: 'Amazon Web Services',
    description: 'Validate your ability to design and implement distributed systems on AWS.',
    icon: '☁️',
    questionCount: 0,
    timeMinutes: 130,
    passingScore: 72,
  },
  {
    id: 'fallback-az-900',
    code: 'AZ-900',
    name: 'Azure Fundamentals',
    provider: 'Microsoft',
    description: 'Demonstrate foundational knowledge of cloud services and Azure.',
    icon: '🔷',
    questionCount: 0,
    timeMinutes: 60,
    passingScore: 70,
  },
  {
    id: 'fallback-gcp-ace',
    code: 'ACE',
    name: 'Google Cloud Associate Cloud Engineer',
    provider: 'Google Cloud',
    description: 'Deploy applications, monitor operations, and manage enterprise solutions on GCP.',
    icon: '🌐',
    questionCount: 0,
    timeMinutes: 120,
    passingScore: 70,
  },
];
