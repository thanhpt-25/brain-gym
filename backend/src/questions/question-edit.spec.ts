import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuestionStatus, QuestionType, UserRole } from '@prisma/client';
import { QuestionsService, canEditAnyQuestion } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';

const OWNER_ID = 'user-owner';
const OTHER_ID = 'user-other';
const QUESTION_ID = 'q-1';

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    createdBy: OWNER_ID,
    certificationId: 'cert-1',
    domainId: 'domain-1',
    title: 'Old title',
    explanation: 'Old explanation',
    questionType: QuestionType.SINGLE,
    status: QuestionStatus.APPROVED,
    deletedAt: null,
    choices: [
      { id: 'c-a', label: 'a', content: 'A', isCorrect: true, sortOrder: 0 },
      { id: 'c-b', label: 'b', content: 'B', isCorrect: false, sortOrder: 1 },
      { id: 'c-c', label: 'c', content: 'C', isCorrect: false, sortOrder: 2 },
    ],
    tags: [{ tag: { id: 't-1', name: 'old-tag' } }],
    ...overrides,
  };
}

function makePrisma(question: ReturnType<typeof makeQuestion> | null) {
  const tx = {
    choice: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    questionTag: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    tag: {
      upsert: jest
        .fn()
        .mockImplementation(({ create }) =>
          Promise.resolve({ id: `tag-${create.name}`, ...create }),
        ),
    },
    question: {
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...question, ...data }),
        ),
    },
  };
  return {
    _tx: tx,
    question: { findUnique: jest.fn().mockResolvedValue(question) },
    domain: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
  };
}

async function build(question: ReturnType<typeof makeQuestion> | null) {
  const prisma = makePrisma(question);
  const kg = {
    enqueueOverlapCompute: jest.fn().mockResolvedValue({ jobId: 'j' }),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      QuestionsService,
      { provide: PrismaService, useValue: prisma },
      {
        provide: GamificationService,
        useValue: { awardPoints: jest.fn().mockResolvedValue(undefined) },
      },
      { provide: KnowledgeGraphService, useValue: kg },
    ],
  }).compile();
  return { service: module.get(QuestionsService), prisma, kg };
}

describe('QuestionsService.updateByOwnerOrEditor', () => {
  describe('permissions', () => {
    it.each([
      [UserRole.LEARNER, OWNER_ID],
      [UserRole.CONTRIBUTOR, OWNER_ID],
      [UserRole.CONTRIBUTOR, OTHER_ID],
      [UserRole.REVIEWER, OTHER_ID],
      [UserRole.ADMIN, OTHER_ID],
    ])('allows %s (user %s)', async (role, userId) => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(userId, role, QUESTION_ID, {
        title: 'New title',
      });
      expect(prisma._tx.question.update).toHaveBeenCalled();
    });

    it('forbids a LEARNER editing someone else’s question', async () => {
      const { service, prisma } = await build(makeQuestion());
      await expect(
        service.updateByOwnerOrEditor(OTHER_ID, UserRole.LEARNER, QUESTION_ID, {
          title: 'x',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('404 for a missing question', async () => {
      const { service } = await build(null);
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          title: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('404 for a soft-deleted question', async () => {
      const { service } = await build(makeQuestion({ deletedAt: new Date() }));
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          title: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('canEditAnyQuestion matches ADMIN/REVIEWER/CONTRIBUTOR only', () => {
      expect(canEditAnyQuestion(UserRole.ADMIN)).toBe(true);
      expect(canEditAnyQuestion(UserRole.REVIEWER)).toBe(true);
      expect(canEditAnyQuestion(UserRole.CONTRIBUTOR)).toBe(true);
      expect(canEditAnyQuestion(UserRole.LEARNER)).toBe(false);
      expect(canEditAnyQuestion(undefined)).toBe(false);
    });
  });

  describe('choices', () => {
    it('updates kept choices in place, creates new ones, deletes removed ones', async () => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(
        OWNER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        {
          choices: [
            { id: 'c-b', content: 'B edited', isCorrect: true },
            { id: 'c-a', content: 'A', isCorrect: false },
            { content: 'New D', isCorrect: false },
          ],
        },
      );
      const tx = prisma._tx;
      expect(tx.choice.deleteMany).toHaveBeenCalledWith({
        where: { questionId: QUESTION_ID, id: { notIn: ['c-b', 'c-a'] } },
      });
      expect(tx.choice.update).toHaveBeenCalledWith({
        where: { id: 'c-b' },
        data: {
          label: 'a',
          content: 'B edited',
          isCorrect: true,
          sortOrder: 0,
        },
      });
      expect(tx.choice.update).toHaveBeenCalledWith({
        where: { id: 'c-a' },
        data: { label: 'b', content: 'A', isCorrect: false, sortOrder: 1 },
      });
      expect(tx.choice.create).toHaveBeenCalledWith({
        data: {
          label: 'c',
          content: 'New D',
          isCorrect: false,
          sortOrder: 2,
          questionId: QUESTION_ID,
        },
      });
    });

    it('does not touch choices when they are not sent', async () => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(
        OWNER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        { title: 'Only title' },
      );
      expect(prisma._tx.choice.deleteMany).not.toHaveBeenCalled();
      expect(prisma._tx.choice.update).not.toHaveBeenCalled();
      expect(prisma._tx.choice.create).not.toHaveBeenCalled();
    });

    it('rejects a choice id that belongs to another question', async () => {
      const { service, prisma } = await build(makeQuestion());
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          choices: [
            { id: 'foreign', content: 'X', isCorrect: true },
            { content: 'Y', isCorrect: false },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects duplicate choice ids', async () => {
      const { service } = await build(makeQuestion());
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          choices: [
            { id: 'c-a', content: 'X', isCorrect: true },
            { id: 'c-a', content: 'Y', isCorrect: false },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects choices with no correct answer', async () => {
      const { service } = await build(makeQuestion());
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          choices: [
            { id: 'c-a', content: 'A', isCorrect: false },
            { id: 'c-b', content: 'B', isCorrect: false },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a SINGLE question with two correct choices', async () => {
      const { service } = await build(makeQuestion());
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          choices: [
            { id: 'c-a', content: 'A', isCorrect: true },
            { id: 'c-b', content: 'B', isCorrect: true },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows two correct choices when switching to MULTIPLE', async () => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(
        OWNER_ID,
        UserRole.ADMIN,
        QUESTION_ID,
        {
          questionType: QuestionType.MULTIPLE,
          choices: [
            { id: 'c-a', content: 'A', isCorrect: true },
            { id: 'c-b', content: 'B', isCorrect: true },
          ],
        },
      );
      expect(prisma._tx.question.update).toHaveBeenCalled();
    });

    it('rejects switching to SINGLE while existing choices have two correct answers', async () => {
      const question = makeQuestion({ questionType: QuestionType.MULTIPLE });
      question.choices[1].isCorrect = true;
      const { service } = await build(question);
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          questionType: QuestionType.SINGLE,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fields, tags, domain', () => {
    it('replaces tags scoped to the question certification (deduped, lowercased)', async () => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(
        OWNER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        { tags: ['S3', 's3 ', 'IAM'] },
      );
      const tx = prisma._tx;
      expect(tx.questionTag.deleteMany).toHaveBeenCalledWith({
        where: { questionId: QUESTION_ID },
      });
      expect(tx.tag.upsert).toHaveBeenCalledTimes(2);
      expect(tx.questionTag.createMany).toHaveBeenCalledWith({
        data: [
          { questionId: QUESTION_ID, tagId: 'tag-s3' },
          { questionId: QUESTION_ID, tagId: 'tag-iam' },
        ],
      });
    });

    it('rejects a domain from another certification', async () => {
      const { service, prisma } = await build(makeQuestion());
      prisma.domain.findUnique.mockResolvedValue({
        id: 'domain-x',
        certificationId: 'cert-other',
      });
      await expect(
        service.updateByOwnerOrEditor(OWNER_ID, UserRole.ADMIN, QUESTION_ID, {
          domainId: 'domain-x',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('schedules KG recompute when domain changes', async () => {
      jest.useFakeTimers();
      try {
        const { service, prisma, kg } = await build(makeQuestion());
        prisma.domain.findUnique.mockResolvedValue({
          id: 'domain-2',
          certificationId: 'cert-1',
        });
        await service.updateByOwnerOrEditor(
          OWNER_ID,
          UserRole.ADMIN,
          QUESTION_ID,
          { domainId: 'domain-2' },
        );
        jest.advanceTimersByTime(6000);
        await Promise.resolve();
        expect(kg.enqueueOverlapCompute).toHaveBeenCalledWith('cert-1');
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps the status of an APPROVED question', async () => {
      const { service, prisma } = await build(makeQuestion());
      await service.updateByOwnerOrEditor(
        OTHER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        { title: 'New' },
      );
      expect(prisma._tx.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: QUESTION_ID },
          data: { title: 'New' },
        }),
      );
    });

    it('moves a REJECTED question back to DRAFT when its author edits it', async () => {
      const { service, prisma } = await build(
        makeQuestion({ status: QuestionStatus.REJECTED }),
      );
      const result = await service.updateByOwnerOrEditor(
        OWNER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        { title: 'Fixed' },
      );
      expect(prisma._tx.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { title: 'Fixed', status: QuestionStatus.DRAFT },
        }),
      );
      expect(result.previous.status).toBe(QuestionStatus.REJECTED);
    });

    it('keeps REJECTED when someone other than the author edits it', async () => {
      const { service, prisma } = await build(
        makeQuestion({ status: QuestionStatus.REJECTED }),
      );
      await service.updateByOwnerOrEditor(
        OTHER_ID,
        UserRole.ADMIN,
        QUESTION_ID,
        { title: 'Fixed' },
      );
      expect(prisma._tx.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { title: 'Fixed' } }),
      );
    });

    it('returns a previous snapshot of the edited fields for audit', async () => {
      const { service } = await build(makeQuestion());
      const result = await service.updateByOwnerOrEditor(
        OTHER_ID,
        UserRole.CONTRIBUTOR,
        QUESTION_ID,
        {
          title: 'New',
          tags: ['x'],
          choices: [
            { id: 'c-a', content: 'A', isCorrect: true },
            { id: 'c-b', content: 'B', isCorrect: false },
          ],
        },
      );
      expect(result.isOwner).toBe(false);
      expect(result.previous.title).toBe('Old title');
      expect(result.previous.tags).toEqual(['old-tag']);
      expect(result.previous.choices).toHaveLength(3);
      expect(result.previous).not.toHaveProperty('explanation');
    });
  });
});
