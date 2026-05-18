import { Test, TestingModule } from '@nestjs/testing';
import { DigestGenerationService } from './digest-generation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { BehavioralService } from '../../insights/behavioral/behavioral.service';

describe('DigestGenerationService', () => {
  let service: DigestGenerationService;
  let prisma: PrismaService;
  let mail: MailService;
  let insights: BehavioralService;

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
              update: jest.fn(),
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
          provide: BehavioralService,
          useValue: {
            getBehavioralInsightsForUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DigestGenerationService>(DigestGenerationService);
    prisma = module.get<PrismaService>(PrismaService);
    mail = module.get<MailService>(MailService);
    insights = module.get<BehavioralService>(BehavioralService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDigestHTML', () => {
    it('should render digest with user insights and stats', async () => {
      const result = await service.generateDigestHTML('user-1', {
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
      expect(result).toContain('7');
      expect(result).toContain('fast learner');
    });

    it('should include progress breakdown by topic', async () => {
      const result = await service.generateDigestHTML('user-1', {
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

    it('should include call-to-action link', async () => {
      const result = await service.generateDigestHTML('user-1', {
        questionsAnswered: 0,
        correctCount: 0,
        streakDays: 0,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(result).toContain('Review Your Progress');
      expect(result).toContain('certgym.com/dashboard');
    });

    it('should include unsubscribe footer', async () => {
      const result = await service.generateDigestHTML('user-1', {
        questionsAnswered: 10,
        correctCount: 8,
        streakDays: 1,
        badgesEarned: [],
        topicProgress: [],
        insights: [],
      });

      expect(result).toContain('Unsubscribe');
      expect(result).toContain('© 2026 CertGym');
    });
  });

  describe('prepareDigestData', () => {
    it('should aggregate stats from last 7 days', async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          type: 'question_answered',
          metadata: {
            questionsAnswered: 1,
            correctCount: 1,
            topic: 'AWS',
            activityDate: new Date().toISOString(),
            badgeEarned: null,
          },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'question_answered',
          metadata: {
            questionsAnswered: 1,
            correctCount: 0,
            topic: 'AWS',
            activityDate: new Date().toISOString(),
            badgeEarned: null,
          },
          createdAt: new Date(),
        },
        {
          userId: 'user-1',
          type: 'badge_earned',
          metadata: { badgeEarned: 'fast_learner' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.prepareDigestData('user-1', sevenDaysAgo);

      expect(result.questionsAnswered).toBe(2);
      expect(result.correctCount).toBe(1);
      expect(result.badgesEarned).toContain('fast_learner');
    });

    it('should calculate accuracy percentage correctly', async () => {
      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 1,
            topic: 'AWS',
            activityDate: new Date().toISOString(),
          },
        },
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 1,
            topic: 'AWS',
            activityDate: new Date().toISOString(),
          },
        },
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 0,
            topic: 'AWS',
            activityDate: new Date().toISOString(),
          },
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
      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue([
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 1,
            topic: 'IAM',
            activityDate: new Date().toISOString(),
          },
        },
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 0,
            topic: 'EC2',
            activityDate: new Date().toISOString(),
          },
        },
        {
          userId: 'user-1',
          metadata: {
            questionsAnswered: 1,
            correctCount: 1,
            topic: 'IAM',
            activityDate: new Date().toISOString(),
          },
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
      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue(
        [],
      );

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
          subject: expect.stringContaining('Weekly CertGym Digest'),
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
      expect(result.sent).toBe(false);
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
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(users);
      (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
        const user = users.find((u) => u.id === args.where.id);
        return Promise.resolve(user);
      });
      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue(
        [],
      );
      (mail.sendEmail as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.generateWeeklyDigests();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionTier: 'PREMIUM',
          }),
        }),
      );
      expect(result.sent).toBe(2);
    });

    it('should report success and error counts', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: false },
        },
        {
          id: 'user-3',
          email: 'user3@example.com',
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(users);
      (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
        const user = users.find((u) => u.id === args.where.id);
        return Promise.resolve(user);
      });
      (insights.getBehavioralInsightsForUser as jest.Mock).mockResolvedValue(
        [],
      );
      (mail.sendEmail as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('SMTP fail'))
        .mockResolvedValueOnce({ success: true });

      const result = await service.generateWeeklyDigests();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should complete without throwing even if some users fail', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          subscriptionTier: 'PREMIUM',
          preferences: { digestEnabled: true },
        },
      ]);

      (insights.getBehavioralInsightsForUser as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.generateWeeklyDigests();

      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe('toggleUserDigestPreference', () => {
    it('should enable digest for user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: false },
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: true },
      });

      const result = await service.toggleUserDigestPreference('user-1', true);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            preferences: expect.objectContaining({
              digestEnabled: true,
            }),
          }),
        }),
      );
      expect(result).toBe(true);
    });

    it('should disable digest for user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: true },
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        preferences: { digestEnabled: false },
      });

      const result = await service.toggleUserDigestPreference('user-1', false);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            preferences: expect.objectContaining({
              digestEnabled: false,
            }),
          }),
        }),
      );
      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.toggleUserDigestPreference(
        'nonexistent',
        true,
      );

      expect(result).toBe(false);
    });
  });
});
