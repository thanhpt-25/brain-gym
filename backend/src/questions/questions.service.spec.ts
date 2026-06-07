import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { QuestionStatus, UserRole, ReportStatus } from '@prisma/client';

const OWNER_ID = 'user-owner';
const OTHER_ID = 'user-other';
const ADMIN_ID = 'user-admin';
const QUESTION_ID = 'q-1';

const baseQuestion: {
  id: string;
  createdBy: string;
  deletedAt: Date | null;
  status: QuestionStatus;
  certificationId: string;
} = {
  id: QUESTION_ID,
  createdBy: OWNER_ID,
  deletedAt: null,
  status: QuestionStatus.APPROVED,
  certificationId: 'cert-1',
};

const deletedResult = {
  ...baseQuestion,
  deletedAt: new Date(),
  status: QuestionStatus.REMOVED,
};

function makeTxMock(updateResult = deletedResult) {
  return {
    report: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    question: { update: jest.fn().mockResolvedValue(updateResult) },
  };
}

function makePrismaMock(
  questionOverride?: Partial<typeof baseQuestion> | null,
  examUsageCount = 0,
) {
  const question =
    questionOverride === null ? null : { ...baseQuestion, ...questionOverride };
  const txMock = makeTxMock(
    question
      ? { ...question, deletedAt: new Date(), status: QuestionStatus.REMOVED }
      : deletedResult,
  );

  return {
    _txMock: txMock,
    question: {
      findUnique: jest.fn().mockResolvedValue(question),
      update: jest.fn().mockResolvedValue(deletedResult),
    },
    examAttempt: {
      count: jest.fn().mockResolvedValue(examUsageCount),
    },
    $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
  };
}

async function buildService(
  questionOverride?: Partial<typeof baseQuestion> | null,
  examUsageCount = 0,
) {
  const prisma = makePrismaMock(questionOverride, examUsageCount);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      QuestionsService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: GamificationService,
        useValue: { awardPoints: jest.fn().mockResolvedValue(undefined) },
      },
      {
        provide: KnowledgeGraphService,
        useValue: { enqueueOverlapCompute: jest.fn() },
      },
    ],
  }).compile();

  return {
    service: module.get<QuestionsService>(QuestionsService),
    prisma,
  };
}

describe('QuestionsService.removeByOwnerOrAdmin', () => {
  it('T-1: admin deletes an APPROVED question authored by another user', async () => {
    const { service } = await buildService();
    const result = await service.removeByOwnerOrAdmin(
      ADMIN_ID,
      UserRole.ADMIN,
      QUESTION_ID,
    );
    expect(result.status).toBe(QuestionStatus.REMOVED);
    expect(result.deletedAt).toBeTruthy();
  });

  it('T-2: owner deletes their own APPROVED question', async () => {
    const { service } = await buildService();
    const result = await service.removeByOwnerOrAdmin(
      OWNER_ID,
      UserRole.CONTRIBUTOR,
      QUESTION_ID,
    );
    expect(result.status).toBe(QuestionStatus.REMOVED);
    expect(result.deletedAt).toBeTruthy();
  });

  it('T-3: owner deletes their own DRAFT question', async () => {
    const { service } = await buildService({ status: QuestionStatus.DRAFT });
    const result = await service.removeByOwnerOrAdmin(
      OWNER_ID,
      UserRole.CONTRIBUTOR,
      QUESTION_ID,
    );
    expect(result.status).toBe(QuestionStatus.REMOVED);
  });

  it('T-4: non-owner non-admin gets ForbiddenException', async () => {
    const { service } = await buildService();
    await expect(
      service.removeByOwnerOrAdmin(OTHER_ID, UserRole.CONTRIBUTOR, QUESTION_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('T-5: non-existent question throws NotFoundException', async () => {
    const { service } = await buildService(null);
    await expect(
      service.removeByOwnerOrAdmin(OWNER_ID, UserRole.CONTRIBUTOR, QUESTION_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('T-6: already soft-deleted question throws NotFoundException', async () => {
    const { service } = await buildService({ deletedAt: new Date() });
    await expect(
      service.removeByOwnerOrAdmin(OWNER_ID, UserRole.CONTRIBUTOR, QUESTION_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('T-7: open reports are resolved inside the transaction', async () => {
    const { service, prisma } = await buildService();
    await service.removeByOwnerOrAdmin(
      OWNER_ID,
      UserRole.CONTRIBUTOR,
      QUESTION_ID,
    );
    expect(prisma._txMock.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { questionId: QUESTION_ID, status: ReportStatus.PENDING },
        data: { status: ReportStatus.RESOLVED },
      }),
    );
  });

  it('T-8: examUsageCount reflects active in-progress sessions', async () => {
    const { service } = await buildService(undefined, 3);
    const result = await service.removeByOwnerOrAdmin(
      OWNER_ID,
      UserRole.CONTRIBUTOR,
      QUESTION_ID,
    );
    expect(result.examUsageCount).toBe(3);
  });
});
