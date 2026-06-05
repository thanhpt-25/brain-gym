/**
 * P1 Recruiting Workflow — unit tests for new service methods:
 *   - updateCandidateDecision (stage, rating, recruiterNote)
 *   - getResults with percentile calculation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';

// ── Minimal prisma mock ──────────────────────────────────────────────────────

const mockAssessment = {
  id: 'a1',
  orgId: 'org-1',
  title: 'Test Assessment',
  passingScore: 70,
  status: 'ACTIVE',
  selectionMode: 'MANUAL',
  selectionConfig: null,
  questionCount: 10,
  timeLimit: 60,
  jobRoleId: null,
  jobRole: null,
};

const mockInvite = {
  id: 'inv-1',
  assessmentId: 'a1',
  candidateEmail: 'test@example.com',
  status: 'SUBMITTED',
  score: 80,
  stage: 'APPLIED',
  rating: null,
  recruiterNote: null,
  decidedBy: null,
  decidedAt: null,
};

const mockPrisma: any = {
  assessment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  candidateInvite: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  orgQuestion: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockOrgsService = {
  resolveOrgId: jest.fn().mockResolvedValue('org-1'),
};

const mockMailService = { sendAssessmentInvite: jest.fn() };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AssessmentsService — P1 Recruiting', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrganizationsService, useValue: mockOrgsService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();
    service = module.get<AssessmentsService>(AssessmentsService);
  });

  // ── updateCandidateDecision ─────────────────────────────────────────────

  describe('updateCandidateDecision', () => {
    beforeEach(() => {
      mockPrisma.assessment.findFirst.mockResolvedValue(mockAssessment);
      mockPrisma.candidateInvite.findFirst.mockResolvedValue(mockInvite);
      mockPrisma.candidateInvite.update.mockResolvedValue({
        ...mockInvite,
        stage: 'SHORTLISTED',
      });
    });

    it('throws NotFoundException if assessment not found', async () => {
      mockPrisma.assessment.findFirst.mockResolvedValue(null);
      await expect(
        service.updateCandidateDecision('org-1', 'a1', 'inv-1', { stage: 'SCREENING' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if invite not found', async () => {
      mockPrisma.candidateInvite.findFirst.mockResolvedValue(null);
      await expect(
        service.updateCandidateDecision('org-1', 'a1', 'inv-1', { stage: 'SCREENING' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates stage to SHORTLISTED and sets decidedBy/decidedAt', async () => {
      await service.updateCandidateDecision(
        'org-1', 'a1', 'inv-1', { stage: 'SHORTLISTED' }, 'recruiter-1',
      );
      expect(mockPrisma.candidateInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'SHORTLISTED',
            decidedBy: 'recruiter-1',
            decidedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('updates stage to SCREENING without setting decidedBy', async () => {
      await service.updateCandidateDecision(
        'org-1', 'a1', 'inv-1', { stage: 'SCREENING' }, 'user-1',
      );
      const call = mockPrisma.candidateInvite.update.mock.calls[0][0];
      expect(call.data.stage).toBe('SCREENING');
      expect(call.data.decidedBy).toBeUndefined();
    });

    it('updates rating without changing stage', async () => {
      await service.updateCandidateDecision(
        'org-1', 'a1', 'inv-1', { rating: 4 }, 'user-1',
      );
      const call = mockPrisma.candidateInvite.update.mock.calls[0][0];
      expect(call.data.rating).toBe(4);
      expect(call.data.stage).toBeUndefined();
    });

    it('updates recruiterNote', async () => {
      await service.updateCandidateDecision(
        'org-1', 'a1', 'inv-1', { recruiterNote: 'Great candidate' }, 'user-1',
      );
      const call = mockPrisma.candidateInvite.update.mock.calls[0][0];
      expect(call.data.recruiterNote).toBe('Great candidate');
    });
  });

  // ── getResults with percentile ──────────────────────────────────────────

  describe('getResults — percentile', () => {
    it('calculates correct percentile for 3 submitted candidates', async () => {
      const invites = [
        { ...mockInvite, id: 'inv-1', status: 'SUBMITTED', score: 90, stage: 'APPLIED' },
        { ...mockInvite, id: 'inv-2', status: 'SUBMITTED', score: 70, stage: 'APPLIED' },
        { ...mockInvite, id: 'inv-3', status: 'SUBMITTED', score: 50, stage: 'APPLIED' },
      ];
      mockPrisma.assessment.findFirst.mockResolvedValue({
        ...mockAssessment, jobRole: null,
      });
      mockPrisma.candidateInvite.findMany.mockResolvedValue(invites);

      const result = await service.getResults('my-org', 'a1');

      // score=90: 2 below → percentile = round(2/2*100) = 100
      expect(result.candidates.find((c) => c.id === 'inv-1')?.percentile).toBe(100);
      // score=70: 1 below → percentile = round(1/2*100) = 50
      expect(result.candidates.find((c) => c.id === 'inv-2')?.percentile).toBe(50);
      // score=50: 0 below → percentile = round(0/2*100) = 0
      expect(result.candidates.find((c) => c.id === 'inv-3')?.percentile).toBe(0);
    });

    it('returns percentile 100 for single submitted candidate', async () => {
      const invites = [
        { ...mockInvite, id: 'inv-1', status: 'SUBMITTED', score: 75, stage: 'APPLIED' },
      ];
      mockPrisma.assessment.findFirst.mockResolvedValue({
        ...mockAssessment, jobRole: null,
      });
      mockPrisma.candidateInvite.findMany.mockResolvedValue(invites);

      const result = await service.getResults('my-org', 'a1');
      expect(result.candidates[0].percentile).toBe(100);
    });

    it('returns null percentile for non-submitted candidates', async () => {
      const invites = [
        { ...mockInvite, id: 'inv-1', status: 'INVITED', score: null, stage: 'APPLIED' },
      ];
      mockPrisma.assessment.findFirst.mockResolvedValue({
        ...mockAssessment, jobRole: null,
      });
      mockPrisma.candidateInvite.findMany.mockResolvedValue(invites);

      const result = await service.getResults('my-org', 'a1');
      expect(result.candidates[0].percentile).toBeNull();
    });

    it('includes jobRole in assessment response', async () => {
      const jobRole = { id: 'jr-1', title: 'Engineer', department: 'Engineering' };
      mockPrisma.assessment.findFirst.mockResolvedValue({
        ...mockAssessment, jobRole,
      });
      mockPrisma.candidateInvite.findMany.mockResolvedValue([]);

      const result = await service.getResults('my-org', 'a1');
      expect(result.assessment.jobRole).toEqual(jobRole);
    });
  });
});
