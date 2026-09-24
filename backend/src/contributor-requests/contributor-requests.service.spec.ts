import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContributorRequestsService } from './contributor-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

const DAY = 24 * 60 * 60 * 1000;
const MOTIVATION =
  'I have passed SAA-C03 and want to write scenario questions.'.padEnd(60, '!');

function buildPrisma() {
  const prisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    contributorRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    examAttempt: {
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    comment: { groupBy: jest.fn().mockResolvedValue([]) },
    report: { groupBy: jest.fn().mockResolvedValue([]) },
    certification: { count: jest.fn(), findMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn) => fn(prisma));
  return prisma;
}

describe('ContributorRequestsService', () => {
  let service: ContributorRequestsService;
  let prisma: any;
  let audit: { log: jest.Mock };
  let mail: {
    sendContributorRequestApproved: jest.Mock;
    sendContributorRequestRejected: jest.Mock;
  };

  const learner = {
    id: 'u1',
    role: 'LEARNER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 30 * DAY),
  };

  /** Default: eligible learner with no previous requests. */
  function mockEligibility(
    overrides: {
      user?: Partial<typeof learner>;
      pending?: object | null;
      lastRejectedAt?: Date | null;
      attempts?: number;
    } = {},
  ) {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...learner,
      ...overrides.user,
    });
    prisma.contributorRequest.findFirst
      .mockResolvedValueOnce(overrides.pending ?? null)
      .mockResolvedValueOnce(
        overrides.lastRejectedAt
          ? { reviewedAt: overrides.lastRejectedAt }
          : null,
      );
    prisma.examAttempt.count.mockResolvedValueOnce(overrides.attempts ?? 5);
  }

  beforeEach(async () => {
    prisma = buildPrisma();
    audit = { log: jest.fn() };
    mail = {
      sendContributorRequestApproved: jest.fn(),
      sendContributorRequestRejected: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ContributorRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(ContributorRequestsService);
  });

  describe('getEligibility', () => {
    it('is eligible for an active learner meeting thresholds', async () => {
      mockEligibility();
      const result = await service.getEligibility('u1');
      expect(result.eligible).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('reports progress for unmet account age and attempts', async () => {
      mockEligibility({
        user: { createdAt: new Date(Date.now() - 2 * DAY) },
        attempts: 1,
      });
      const result = await service.getEligibility('u1');
      expect(result.eligible).toBe(false);
      expect(result.checks).toEqual(
        expect.arrayContaining([
          { key: 'ACCOUNT_AGE', passed: false, current: 2, required: 7 },
          { key: 'COMPLETED_ATTEMPTS', passed: false, current: 1, required: 3 },
        ]),
      );
    });

    it('applies the 30 day cooldown after a rejection', async () => {
      const rejectedAt = new Date(Date.now() - 29 * DAY);
      mockEligibility({ lastRejectedAt: rejectedAt });
      const result = await service.getEligibility('u1');
      expect(result.eligible).toBe(false);
      expect(result.retryAfter).toBe(
        new Date(rejectedAt.getTime() + 30 * DAY).toISOString(),
      );
    });

    it('lifts the cooldown once 30 days have passed', async () => {
      mockEligibility({ lastRejectedAt: new Date(Date.now() - 30 * DAY - 1) });
      const result = await service.getEligibility('u1');
      expect(result.eligible).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a PENDING request and audits it', async () => {
      mockEligibility();
      prisma.certification.count.mockResolvedValue(1);
      prisma.contributorRequest.create.mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
        motivation: MOTIVATION,
        expertise: ['c1'],
        sampleUrl: null,
        decisionReason: null,
        reviewedAt: null,
        createdAt: new Date(),
      });

      const result = await service.create('u1', {
        motivation: MOTIVATION,
        expertise: ['c1', 'c1'],
      });

      expect(result.status).toBe('PENDING');
      expect(prisma.contributorRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', expertise: ['c1'] }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONTRIBUTOR_REQUEST_CREATED' }),
      );
    });

    it('rejects non-learners with 409 ALREADY_CONTRIBUTOR', async () => {
      mockEligibility({ user: { role: 'CONTRIBUTOR' } });
      await expect(
        service.create('u1', { motivation: MOTIVATION }),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: 'ALREADY_CONTRIBUTOR' }),
      });
    });

    it('rejects inactive accounts with 403', async () => {
      mockEligibility({ user: { status: 'SUSPENDED' } });
      await expect(
        service.create('u1', { motivation: MOTIVATION }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a second pending request with 409', async () => {
      mockEligibility({ pending: { id: 'r0' } });
      await expect(
        service.create('u1', { motivation: MOTIVATION }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REQUEST_ALREADY_PENDING' }),
      });
    });

    it('rejects during cooldown with 429 and retryAfter', async () => {
      mockEligibility({ lastRejectedAt: new Date(Date.now() - DAY) });
      const err = await service
        .create('u1', { motivation: MOTIVATION })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse().retryAfter).toBeDefined();
    });

    it('rejects unmet thresholds with NOT_ELIGIBLE reasons', async () => {
      mockEligibility({ attempts: 0 });
      await expect(
        service.create('u1', { motivation: MOTIVATION }),
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          code: 'NOT_ELIGIBLE',
          reasons: [expect.objectContaining({ key: 'COMPLETED_ATTEMPTS' })],
        }),
      });
    });

    it('rejects unknown certification ids', async () => {
      mockEligibility();
      prisma.certification.count.mockResolvedValue(0);
      await expect(
        service.create('u1', { motivation: MOTIVATION, expertise: ['nope'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a unique-index race (P2002) to 409', async () => {
      mockEligibility();
      prisma.contributorRequest.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.create('u1', { motivation: MOTIVATION }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REQUEST_ALREADY_PENDING' }),
      });
    });
  });

  describe('cancelMine', () => {
    it('cancels the pending request', async () => {
      prisma.contributorRequest.findFirst.mockResolvedValue({ id: 'r1' });
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.cancelMine('u1')).resolves.toEqual({
        id: 'r1',
        status: 'CANCELLED',
      });
    });

    it('404s without a pending request', async () => {
      prisma.contributorRequest.findFirst.mockResolvedValue(null);
      await expect(service.cancelMine('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    beforeEach(() => {
      prisma.contributorRequest.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: 'PENDING',
      });
    });

    it('promotes the learner, audits twice and emails', async () => {
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'l@x.io',
        displayName: 'L',
        role: 'LEARNER',
        status: 'ACTIVE',
      });

      const result = await service.approve('r1', 'admin', ' welcome ');

      expect(result.role).toBe('CONTRIBUTOR');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: 'CONTRIBUTOR' },
      });
      const actions = audit.log.mock.calls.map((c) => c[0].action);
      expect(actions).toEqual(['CONTRIBUTOR_REQUEST_APPROVED', 'ROLE_CHANGED']);
      expect(mail.sendContributorRequestApproved).toHaveBeenCalledWith(
        'l@x.io',
        'L',
        'welcome',
      );
    });

    it('does not downgrade a user who is already REVIEWER', async () => {
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'l@x.io',
        displayName: 'L',
        role: 'REVIEWER',
        status: 'ACTIVE',
      });

      const result = await service.approve('r1', 'admin');

      expect(result.role).toBe('REVIEWER');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log.mock.calls[0][0].metadata.roleUnchanged).toBe(true);
    });

    it('409s when another admin already handled it', async () => {
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.approve('r1', 'admin')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REQUEST_NOT_PENDING' }),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('409s (and rolls back) when the user is not active', async () => {
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'LEARNER',
        status: 'BANNED',
      });
      await expect(service.approve('r1', 'admin')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'USER_NOT_ACTIVE' }),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mail.sendContributorRequestApproved).not.toHaveBeenCalled();
    });

    it('refuses to review your own request', async () => {
      await expect(service.approve('r1', 'u1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('404s for unknown requests', async () => {
      prisma.contributorRequest.findUnique.mockResolvedValue(null);
      await expect(service.approve('nope', 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      prisma.contributorRequest.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: 'PENDING',
      });
    });

    it('rejects with a reason and emails the retry date', async () => {
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        email: 'l@x.io',
        displayName: 'L',
      });

      await service.reject('r1', 'admin', 'Please complete more exams first');

      expect(prisma.contributorRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'REJECTED',
          decisionReason: 'Please complete more exams first',
        }),
      });
      expect(mail.sendContributorRequestRejected).toHaveBeenCalledWith(
        'l@x.io',
        'L',
        'Please complete more exams first',
        expect.any(Date),
      );
    });

    it('requires a reason', async () => {
      await expect(service.reject('r1', 'admin', '  ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('409s when already handled', async () => {
      prisma.contributorRequest.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        status: 'APPROVED',
      });
      await expect(
        service.reject('r1', 'admin', 'Too late for this one'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cancelPendingOnRoleChange', () => {
    it('is a no-op when demoting to LEARNER', async () => {
      await expect(
        service.cancelPendingOnRoleChange(['u1'], 'LEARNER', 'admin'),
      ).resolves.toBe(0);
      expect(prisma.contributorRequest.findMany).not.toHaveBeenCalled();
    });

    it('cancels pending requests of promoted users and audits each', async () => {
      prisma.contributorRequest.findMany.mockResolvedValue([
        { id: 'r1', userId: 'u1' },
      ]);
      prisma.contributorRequest.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.cancelPendingOnRoleChange(['u1'], 'CONTRIBUTOR', 'admin'),
      ).resolves.toBe(1);
      expect(prisma.contributorRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['r1'] }, status: 'PENDING' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_REQUEST_AUTO_CANCELLED',
        }),
      );
    });
  });

  describe('adminList', () => {
    it('attaches batched activity snapshots', async () => {
      prisma.contributorRequest.findMany.mockResolvedValue([
        { id: 'r1', userId: 'u1', expertise: ['c1'] },
      ]);
      prisma.contributorRequest.count.mockResolvedValue(1);
      prisma.examAttempt.groupBy.mockResolvedValue([
        { userId: 'u1', _count: { _all: 4 }, _avg: { score: 72.345 } },
      ]);
      prisma.certification.findMany.mockResolvedValue([
        { id: 'c1', name: 'SAA', code: 'SAA-C03' },
      ]);

      const result = await service.adminList({});

      expect(prisma.contributorRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result.data[0].stats).toMatchObject({
        completedAttempts: 4,
        avgScore: 72.3,
      });
      expect(result.data[0].expertiseCertifications).toEqual([
        { id: 'c1', name: 'SAA', code: 'SAA-C03' },
      ]);
    });

    it('rejects an invalid status filter', async () => {
      await expect(
        service.adminList({ status: 'bogus' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
