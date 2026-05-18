import { Test, TestingModule } from '@nestjs/testing';
import { ScenariosService } from './scenarios.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmUsageService } from '../ai-question-bank/llm-usage/llm-usage.service';
import { ExplanationGenerationService } from './explanation-generation.service';
import { ConfigService } from '@nestjs/config';

describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: PrismaService;
  let llmUsage: LlmUsageService;
  let config: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenariosService,
        {
          provide: PrismaService,
          useValue: {
            scenario: { create: jest.fn(), findUnique: jest.fn() },
            scenarioQuestion: { create: jest.fn() },
            scenarioAttempt: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: LlmUsageService,
          useValue: {
            recordUsageEvent: jest.fn(),
            getOrgDailyCost: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ExplanationGenerationService,
          useValue: {
            generateExplanation: jest.fn().mockResolvedValue({
              explanation: 'Test explanation',
              keyInsights: ['Insight 1'],
              misconceptionAddress: 'No misconception',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ScenariosService>(ScenariosService);
    prisma = module.get<PrismaService>(PrismaService);
    llmUsage = module.get<LlmUsageService>(LlmUsageService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validatePassage', () => {
    it('should validate a valid passage', () => {
      const passage = `Cloud computing is the delivery of computing services over the internet. This includes servers, storage, databases, networking, software, analytics, and intelligence. Cloud computing offers flexible resources, lower costs, and easy scalability. Organizations can scale up or down based on demand without significant capital investment. Security is built into the platform with encryption at rest and in transit. Compliance with international standards ensures data protection and regulatory requirements are met. The infrastructure is maintained by cloud providers reducing operational overhead. Major providers include Amazon Web Services, Microsoft Azure, and Google Cloud Platform offering various service models. Infrastructure as a Service provides virtual computing resources over the internet. Platform as a Service offers development tools and databases for building applications. Software as a Service delivers applications directly through web browsers. These models allow businesses to focus on core competencies while outsourcing IT infrastructure management. The adoption of cloud computing has increased significantly across industries. Organizations benefit from improved disaster recovery capabilities and business continuity planning. The scalability of cloud infrastructure allows for rapid deployment of new services and features. Cost optimization through cloud services enables businesses to invest in innovation rather than infrastructure management. Virtualization technology enables multiple operating systems to run on single physical servers. Load balancing ensures optimal resource utilization and high availability. Automation simplifies operational management tasks significantly.`;
      const result = service.validatePassage(passage);

      expect(result.valid).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(200);
      expect(result.wordCount).toBeLessThanOrEqual(400);
    });

    it('should reject empty passage', () => {
      const result = service.validatePassage('');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject passage with too few words', () => {
      const passage = 'Cloud is great';
      const result = service.validatePassage(passage);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should reject passage with too many words', () => {
      const words = Array(450).fill('word').join(' ');
      const result = service.validatePassage(words);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });
  });

  describe('generateQuestionsFromPassage', () => {
    it('should generate questions from a valid passage', async () => {
      const passage = `Cloud computing is the delivery of computing services over the internet. This includes servers, storage, databases, networking, software, analytics, and intelligence. Cloud computing offers flexible resources, lower costs, and easy scalability. Organizations can scale up or down based on demand without significant capital investment. Security is built into the platform with encryption at rest and in transit. Compliance with international standards ensures data protection and regulatory requirements are met. The infrastructure is maintained by cloud providers reducing operational overhead. Major providers include Amazon Web Services, Microsoft Azure, and Google Cloud Platform offering various service models. Infrastructure as a Service provides virtual computing resources over the internet. Platform as a Service offers development tools and databases for building applications. Software as a Service delivers applications directly through web browsers. These models allow businesses to focus on core competencies while outsourcing IT infrastructure management. The adoption of cloud computing has increased significantly across industries. Organizations benefit from improved disaster recovery capabilities and business continuity planning. The scalability of cloud infrastructure allows for rapid deployment of new services and features. Cost optimization through cloud services enables businesses to invest in innovation rather than infrastructure management. Virtualization technology enables multiple operating systems to run on single physical servers. Load balancing ensures optimal resource utilization and high availability. Automation simplifies operational management tasks significantly.`;

      jest.spyOn(service, 'callLlmWithTimeout').mockResolvedValue({
        questions: [
          {
            question: 'What is cloud computing?',
            correctAnswer: 'Delivery of computing services over the internet',
            distractors: ['A type of server', 'A data storage device'],
            reasoning:
              'Cloud computing is defined as the delivery of computing services over the internet.',
          },
        ],
      });

      const questions = await service.generateQuestionsFromPassage(passage);

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThanOrEqual(1);
      expect(questions.length).toBeLessThanOrEqual(5);

      questions.forEach((q) => {
        expect(q.question).toBeDefined();
        expect(q.correctAnswer).toBeDefined();
        expect(Array.isArray(q.distractors)).toBe(true);
        expect(q.distractors.length).toBeGreaterThanOrEqual(2);
        expect(q.reasoning).toBeDefined();
      });
    });

    it('should generate unique questions', async () => {
      const passage = `Cloud computing is the delivery of computing services over the internet. This includes servers, storage, databases, networking, software, analytics, and intelligence. Cloud computing offers flexible resources, lower costs, and easy scalability. Organizations can scale up or down based on demand without significant capital investment. Security is built into the platform with encryption at rest and in transit. Compliance with international standards ensures data protection and regulatory requirements are met. The infrastructure is maintained by cloud providers reducing operational overhead. Major providers include Amazon Web Services, Microsoft Azure, and Google Cloud Platform offering various service models. Infrastructure as a Service provides virtual computing resources over the internet. Platform as a Service offers development tools and databases for building applications. Software as a Service delivers applications directly through web browsers. These models allow businesses to focus on core competencies while outsourcing IT infrastructure management. The adoption of cloud computing has increased significantly across industries. Organizations benefit from improved disaster recovery capabilities and business continuity planning. The scalability of cloud infrastructure allows for rapid deployment of new services and features. Cost optimization through cloud services enables businesses to invest in innovation rather than infrastructure management. Virtualization technology enables multiple operating systems to run on single physical servers. Load balancing ensures optimal resource utilization and high availability. Automation simplifies operational management tasks significantly.`;

      jest.spyOn(service, 'callLlmWithTimeout').mockResolvedValue({
        questions: [
          {
            question: 'What is cloud computing?',
            correctAnswer: 'Delivery of computing services over the internet',
            distractors: ['A type of server', 'A data storage device'],
            reasoning:
              'Cloud computing is defined as delivery of services over the internet.',
          },
          {
            question: 'What are major cloud providers?',
            correctAnswer: 'AWS, Azure, Google Cloud',
            distractors: ['IBM and Oracle only', 'Facebook and Twitter'],
            reasoning:
              'Major providers are AWS, Azure, and Google Cloud Platform.',
          },
        ],
      });

      const questions = await service.generateQuestionsFromPassage(passage);
      const questionTexts = questions.map((q) => q.question);
      const uniqueTexts = new Set(questionTexts);

      expect(uniqueTexts.size).toBe(questionTexts.length);
    });
  });

  describe('getUserScenarioProgress', () => {
    it('should return user progress for scenarios', async () => {
      const userId = 'user-123';

      (prisma.scenarioAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'attempt-1',
          userId,
          scenarioId: 'scenario-1',
          score: 80,
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          scenario: {
            id: 'scenario-1',
            passage: 'Test passage',
          },
          attemptedAt: new Date(),
        },
      ] as any);

      const progress = await service.getUserScenarioProgress(userId);

      expect(progress).toBeDefined();
      expect(typeof progress.totalAttempts).toBe('number');
      expect(typeof progress.averageScore).toBe('number');
      expect(Array.isArray(progress.recentAttempts)).toBe(true);
    });
  });

  describe('submitAttempt', () => {
    it('should submit an attempt and return result', async () => {
      const userId = 'user-123';
      const scenarioId = 'scenario-1';
      const answers = { 'q-1': 'a-1' };

      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue({
        id: scenarioId,
        passage: 'Test passage',
        questions: [
          {
            id: 'sq-1',
            scenarioId,
            order: 1,
            questionId: 'q-1',
            question: {
              id: 'q-1',
              title: 'Question 1',
              choices: [
                {
                  id: 'a-1',
                  label: 'A',
                  content: 'Answer 1',
                  isCorrect: true,
                  questionId: 'q-1',
                },
                {
                  id: 'a-2',
                  label: 'B',
                  content: 'Answer 2',
                  isCorrect: false,
                  questionId: 'q-1',
                },
              ],
            },
          },
        ],
      } as any);

      (prisma.scenarioAttempt.create as jest.Mock).mockResolvedValue({
        id: 'attempt-1',
        userId,
        scenarioId,
        score: 100,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.submitAttempt(userId, scenarioId, answers);

      expect(result).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
