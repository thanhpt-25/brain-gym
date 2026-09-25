import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanDb,
  createAdminUser,
  createTestUser,
  getOrCreateCertification,
  TestUserResult,
} from './helpers';

// docs/specs/question-edit-srs.md
describe('Question edit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestUserResult;
  let certId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDb(prisma as any);
    owner = await createTestUser(app, {
      suffix: 'qe-owner',
      role: UserRole.CONTRIBUTOR,
    });
    ({ certId } = await getOrCreateCertification(prisma, {
      certCode: 'QEDIT',
    }));
  });

  afterAll(async () => {
    // Leave no questions behind: later suites (e.g. digest) delete users directly.
    if (prisma) await cleanDb(prisma as any);
    if (app) await app.close();
  });

  async function createQuestion(status: 'APPROVED' | 'REJECTED' = 'APPROVED') {
    return prisma.question.create({
      data: {
        certificationId: certId,
        createdBy: owner.userId,
        title: 'Original title',
        explanation: 'Original explanation',
        status,
        choices: {
          create: [
            { label: 'a', content: 'Wrong', isCorrect: false, sortOrder: 0 },
            { label: 'b', content: 'Right', isCorrect: true, sortOrder: 1 },
            {
              label: 'c',
              content: 'Also wrong',
              isCorrect: false,
              sortOrder: 2,
            },
          ],
        },
      },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  const edit = (id: string, token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put(`/questions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('author edits content; choice ids of kept choices stay stable and past answers still resolve', async () => {
    const q = await createQuestion();
    const [a, b, c] = q.choices;

    // A past attempt that selected choice b.
    const exam = await prisma.exam.create({
      data: {
        createdBy: owner.userId,
        certificationId: certId,
        title: 'Exam',
        questionCount: 1,
        timeLimit: 10,
        examQuestions: { create: [{ questionId: q.id, sortOrder: 0 }] },
      },
    });
    const attempt = await prisma.examAttempt.create({
      data: { userId: owner.userId, examId: exam.id, totalQuestions: 1 },
    });
    await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: q.id,
        selectedChoices: [b.id],
        isCorrect: true,
      },
    });

    const res = await edit(q.id, owner.token, {
      title: 'Edited title',
      explanation: 'Edited explanation',
      tags: ['S3', 'iam'],
      choices: [
        { id: b.id, content: 'Right (edited)', isCorrect: true },
        { id: a.id, content: 'Wrong', isCorrect: false },
        { content: 'New option', isCorrect: false },
      ],
    }).expect(200);

    expect(res.body.title).toBe('Edited title');
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.choices.map((x: any) => x.label)).toEqual(['a', 'b', 'c']);
    expect(res.body.choices[0].id).toBe(b.id);
    expect(res.body.choices[1].id).toBe(a.id);
    expect(res.body.choices.map((x: any) => x.id)).not.toContain(c.id);
    expect(res.body.tags.map((t: any) => t.tag.name).sort()).toEqual([
      'iam',
      's3',
    ]);

    // Past answer untouched and its selected choice still exists.
    const answer = await prisma.answer.findFirst({
      where: { attemptId: attempt.id },
    });
    expect(answer!.isCorrect).toBe(true);
    const selected = await prisma.choice.findUnique({
      where: { id: answer!.selectedChoices[0] },
    });
    expect(selected!.content).toBe('Right (edited)');

    const log = await prisma.auditLog.findFirst({
      where: { action: 'QUESTION_EDITED', targetId: q.id },
    });
    expect(log).not.toBeNull();
    expect((log!.metadata as any).previous.title).toBe('Original title');
    expect((log!.metadata as any).isOwner).toBe(true);
  });

  it('contributor, reviewer and admin can edit someone else’s question', async () => {
    const q = await createQuestion();
    for (const role of [
      UserRole.CONTRIBUTOR,
      UserRole.REVIEWER,
      UserRole.ADMIN,
    ]) {
      const user =
        role === UserRole.ADMIN
          ? await createAdminUser(app, 'qe-admin')
          : await createTestUser(app, { suffix: `qe-${role}`, role });
      await edit(q.id, user.token, { title: `By ${role}` }).expect(200);
    }
    const after = await prisma.question.findUnique({ where: { id: q.id } });
    expect(after!.title).toBe('By ADMIN');
    expect(after!.createdBy).toBe(owner.userId);
  });

  it('learner cannot edit someone else’s question; anonymous gets 401', async () => {
    const q = await createQuestion();
    const learner = await createTestUser(app, { suffix: 'qe-learner' });
    await edit(q.id, learner.token, { title: 'Hijack' }).expect(403);
    await request(app.getHttpServer())
      .put(`/questions/${q.id}`)
      .send({ title: 'Anon' })
      .expect(401);
    const after = await prisma.question.findUnique({ where: { id: q.id } });
    expect(after!.title).toBe('Original title');
  });

  it('rejects invalid payloads without changing anything', async () => {
    const q = await createQuestion();
    // No correct answer
    await edit(q.id, owner.token, {
      choices: [
        { id: q.choices[0].id, content: 'x', isCorrect: false },
        { id: q.choices[1].id, content: 'y', isCorrect: false },
      ],
    }).expect(400);
    // Only one choice
    await edit(q.id, owner.token, {
      choices: [{ id: q.choices[1].id, content: 'y', isCorrect: true }],
    }).expect(400);
    // Foreign choice id
    await edit(q.id, owner.token, {
      choices: [
        {
          id: '00000000-0000-0000-0000-000000000000',
          content: 'x',
          isCorrect: true,
        },
        { content: 'y', isCorrect: false },
      ],
    }).expect(400);
    // Empty title
    await edit(q.id, owner.token, { title: '' }).expect(400);

    const choices = await prisma.choice.findMany({
      where: { questionId: q.id },
    });
    expect(choices).toHaveLength(3);
  });

  it('author editing a REJECTED question moves it back to DRAFT so it can be resubmitted', async () => {
    const q = await createQuestion('REJECTED');
    const res = await edit(q.id, owner.token, { title: 'Fixed' }).expect(200);
    expect(res.body.status).toBe('DRAFT');
    await request(app.getHttpServer())
      .put(`/questions/${q.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'PENDING' })
      .expect(200);
  });

  it('404 for a deleted question', async () => {
    const q = await createQuestion();
    await prisma.question.update({
      where: { id: q.id },
      data: { deletedAt: new Date(), status: 'REMOVED' },
    });
    await edit(q.id, owner.token, { title: 'x' }).expect(404);
  });
});
