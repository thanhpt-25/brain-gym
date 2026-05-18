import { Test, TestingModule } from '@nestjs/testing';
import { DigestGenerationService } from '../src/mail/digest/digest-generation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { BehavioralInsightService } from '../src/behavioral-insights/behavioral-insights.service';

describe('DigestGenerationService', () => {
  let service: DigestGenerationService;
  let prisma: PrismaService;
  let mail: MailService;
  let insights: BehavioralInsightService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestGenerationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            organizationUser: {
              findMany: jest.fn(),
            },
            behavioralInsight: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: MailService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
        {
          provide: BehavioralInsightService,
          useValue: {
            getUserInsights: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DigestGenerationService>(DigestGenerationService);
    prisma = module.get<PrismaService>(PrismaService);
    mail = module.get<MailService>(MailService);
    insights = module.get<BehavioralInsightService>(BehavioralInsightService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDigestHTML', () => {
    it('should render digest with user insights and stats', () => {
      const result = service.generateDigestHTML('user-1', {
        questionsAnswered: 42,
        correctCount: 35,
        streakDays: 7,
        badgesEarned: ['fast_learner', 'streak_master'],
        topicProgress: [
          { topic: 'AWS', mastery: 0.8, questionsAnswered: 15 },
          { topic: 'Docker', mastery: 0.6, questionsAnswered: 12 },
        ],
        insights: [
          'You improved AWS mastery by 15% this week',
          'Try harder certifications for faster progress',
        ],
      });

      expect(result).toContain('Weekly Summary');
      expect(result).toContain('42');
      expect(result).toContain('7-day streak');
      expect(result).toContain('fast_learner');
    });

    it('should include progress breakdown by topic', () => {
      const result = service.generateDigestHTML('user-1', {
        questionsAnswered: 20,
        correctCount: 16,
        streakDays: 3,
        badgesEarned: [],
        topicProgress: [
          { topic: 'Kubernetes', mastery: 0.75, questionsAnswered: 10 },
          { topic: 'Terraform', mastery: 0.4, questionsAnswered: 10 },
        ],
        insights: ['Strong Kubernetes performance'],
      });

      expect(result).toContain('Kubernetes');
      expect(result).toContain('Terraform');
      expect(result).toContain('75%');
      expect(result).toContain('40%');
    });

    it('should include call-to-action link', () => {
      const result = service.generateDigestHTML('user-1', {
        questionsAnswered: 0,
        correctCount: 0,
        streakDays: 0,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(result).toContain('Review your progress');
      expect(result).toContain('/dashboard');
    });

    it('should include unsubscribe footer', () => {
      const result = service.generateDigestHTML('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 1,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(result).toContain('Unsubscribe');
      expect(result).toContain('manage preferences');
    });
  });

  describe('prepareDigestData', () => {
    it('should aggregate stats from last 7 days', async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { certId: 'aws', correct: true },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { certId: 'aws', correct: false },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'streak',
          data: { days: 5 },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'badge_earned',
          data: { badgeId: 'fast_learner' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.prepareDigestData('user-1', sevenDaysAgo);

      expect(result.questionsAnswered).toBe(2);
      expect(result.correctCount).toBe(1);
      expect(result.streakDays).toBe(5);
      expect(result.badgesEarned).toContain('fast_learner');
    });

    it('should calculate accuracy percentage correctly', async () => {
      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { correct: true },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { correct: true },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { correct: false },
          createdAt: new Date(),
        },
      ]);

      const result = await service.prepareDigestData(
        'user-1',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );

      expect(result.questionsAnswered).toBe(3);
      expect(result.correctCount).toBe(2);
    });

    it('should group progress by topic/certification', async () => {
      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { certId: 'aws-sa', domain: 'IAM' },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { certId: 'aws-sa', domain: 'EC2' },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          data: { certId: 'gcp', domain: 'IAM' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.prepareDigestData(
        'user-1',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );

      expect(result.topicProgress).toBeDefined();
      expect(result.topicProgress.length).toBeGreaterThan(0);
    });

    it('should handle empty insight data gracefully', async () => {
      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.prepareDigestData(
        'user-1',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );

      expect(result.questionsAnswered).toBe(0);
      expect(result.correctCount).toBe(0);
      expect(result.streakDays).toBe(0);
      expect(result.badgesEarned).toEqual([]);
    });
  });

  describe('sendDigestToUser', () => {
    it('should send digest email to user with digest enabled', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        preferences: { digestEnabled: true },
      });

      (mail.sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.sendDigestToUser('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 2,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(mail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Weekly Summary'),
        }),
      );
      expect(result.sent).toBe(true);
    });

    it('should skip digest if user has opted out', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        preferences: { digestEnabled: false },
      });

      const result = await service.sendDigestToUser('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 2,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(mail.sendEmail).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('should handle email sending errors gracefully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        preferences: { digestEnabled: true },
      });

      (mail.sendEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP timeout'),
      );

      const result = await service.sendDigestToUser('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 2,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(result.error).toContain('SMTP timeout');
      expect(result.sent).toBe(false);
    });

    it('should log email sent event', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        preferences: { digestEnabled: true },
      });

      (mail.sendEmail as jest.Mock).mockResolvedValue({ success: true });
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.sendDigestToUser('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 2,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Digest sent'),
      );
    });
  });

  describe('generateWeeklyDigests', () => {
    it('should generate digests for all premium users with digest enabled', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(users);
      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([]);
      (mail.sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.generateWeeklyDigests();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tier: 'PREMIUM',
          }),
        }),
      );
      expect(result.sent).toBe(2);
    });

    it('should skip free tier users', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'free-user',
          email: 'free@example.com',
          tier: 'FREE',
          preferences: { digestEnabled: true },
        },
      ]);

      const result = await service.generateWeeklyDigests();

      expect(mail.sendEmail).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('should report success and error counts', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user1@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: false },
        },
        {
          id: 'user-3',
          email: 'user3@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ]);

      (prisma.behavioralInsight.findMany as jest.Mock).mockResolvedValue([]);
      (mail.sendEmail as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('SMTP fail'))
        .mockResolvedValueOnce({ success: true });

      const result = await service.generateWeeklyDigests();

      expect(result.sent).toBe(2);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.skipped).toBe(1);
    });

    it('should complete without throwing even if some users fail', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          tier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ]);

      (prisma.behavioralInsight.findMany as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.generateWeeklyDigests();

      expect(result.failed).toBeGreaterThan(0);
      expect(result.completed).toBe(true);
    });
  });

  describe('toggleUserDigestPreference', () => {
    it('should enable digest for user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: false },
      });

      await service.toggleUserDigestPreference('user-1', true);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should disable digest for user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: true },
      });

      await service.toggleUserDigestPreference('user-1', false);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.toggleUserDigestPreference('nonexistent', true),
      ).rejects.toThrow();
    });
  });

  describe('calculateStreakDays', () => {
    it('should calculate consecutive days of activity', () => {
      const insights = [
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-17'),
        },
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-16'),
        },
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-15'),
        },
      ];

      const result = service.calculateStreakDays(insights);

      expect(result).toBe(3);
    });

    it('should break streak on gap', () => {
      const insights = [
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-17'),
        },
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-16'),
        },
        {
          type: 'question_answered',
          createdAt: new Date('2026-05-14'), // gap
        },
      ];

      const result = service.calculateStreakDays(insights);

      expect(result).toBe(1); // only today
    });

    it('should return 0 for no activities', () => {
      const result = service.calculateStreakDays([]);

      expect(result).toBe(0);
    });
  });

  describe('calculateMasteryByTopic', () => {
    it('should calculate mastery as accuracy per topic', () => {
      const insights = [
        {
          type: 'question_answered',
          data: { domain: 'IAM', correct: true },
        },
        {
          type: 'question_answered',
          data: { domain: 'IAM', correct: true },
        },
        {
          type: 'question_answered',
          data: { domain: 'IAM', correct: false },
        },
        {
          type: 'question_answered',
          data: { domain: 'EC2', correct: true },
        },
      ];

      const result = service.calculateMasteryByTopic(insights);

      expect(result['IAM']).toBeCloseTo(0.67, 1);
      expect(result['EC2']).toBe(1.0);
    });

    it('should handle topics with no correct answers', () => {
      const insights = [
        {
          type: 'question_answered',
          data: { domain: 'RDS', correct: false },
        },
        {
          type: 'question_answered',
          data: { domain: 'RDS', correct: false },
        },
      ];

      const result = service.calculateMasteryByTopic(insights);

      expect(result['RDS']).toBe(0);
    });
  });

  describe('formatAggregateInsights', () => {
    it('should format insights array as readable bullets', () => {
      const insightData = {
        topicProgress: [
          { topic: 'AWS', mastery: 0.9 },
          { topic: 'Docker', mastery: 0.4 },
        ],
        questionsAnswered: 50,
        streakDays: 7,
      };

      const result = service.formatAggregateInsights(insightData);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('AWS');
    });
  });
});
