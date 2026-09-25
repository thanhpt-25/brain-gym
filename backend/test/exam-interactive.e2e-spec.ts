import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { FeedbackMode, TimerMode } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanDb,
  createTestUser,
  getOrCreateCertification,
  TestUserResult,
} from './helpers';

// docs/specs/exam-interactive-mode-srs.md
describe('Exam interactive mode (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let learner: TestUserResult;
  let examId: string;
  let q1: { id: string; correct: string; wrong: string };
  let q2: { id: string; correct: string; wrong: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDb(prisma as any);
    learner = await createTestUser(app, { suffix: 'interactive' });
    ({ examId, q1, q2 } = await createExam(TimerMode.STRICT));
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function createQuestion(
    certId: string,
    title: string,
    explanation: string | null,
  ) {
    const q = await prisma.question.create({
      data: {
        certificationId: certId,
        createdBy: learner.userId,
        title,
        explanation,
        status: 'APPROVED',
        choices: {
          create: [
            { label: 'a', content: 'Wrong', isCorrect: false, sortOrder: 0 },
            { label: 'b', content: 'Right', isCorrect: true, sortOrder: 1 },
          ],
        },
      },
      include: { choices: true },
    });
    return {
      id: q.id,
      correct: q.choices.find((c) => c.isCorrect)!.id,
      wrong: q.choices.find((c) => !c.isCorrect)!.id,
    };
  }

  async function createExam(timerMode: TimerMode) {
    const { certId } = await getOrCreateCertification(prisma, {
      certCode: `INT-${timerMode}`,
    });
    const a = await createQuestion(certId, 'Q1', 'Because **b** is right.');
    const b = await createQuestion(certId, 'Q2', null);
    const exam = await prisma.exam.create({
      data: {
        createdBy: learner.userId,
        certificationId: certId,
        title: 'Interactive exam',
        questionCount: 2,
        timeLimit: 30,
        timerMode,
        examQuestions: {
          create: [
            { questionId: a.id, sortOrder: 0 },
            { questionId: b.id, sortOrder: 1 },
          ],
        },
      },
    });
    return { examId: exam.id, q1: a, q2: b };
  }

  async function createAttempt(
    userId: string,
    feedbackMode: FeedbackMode,
    forExamId = examId,
  ) {
    return prisma.examAttempt.create({
      data: { userId, examId: forExamId, totalQuestions: 2, feedbackMode },
    });
  }

  const check = (
    attemptId: string,
    body: { questionId: string; selectedChoices: string[] },
    token = learner.token,
  ) =>
    request(app.getHttpServer())
      .post(`/attempts/${attemptId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('full flow: start INTERACTIVE → check → submit keeps the checked answers', async () => {
    const server = app.getHttpServer();

    const start = await request(server)
      .post(`/exams/${examId}/start`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ feedbackMode: 'INTERACTIVE' })
      .expect(201);
    expect(start.body.feedbackMode).toBe('INTERACTIVE');
    // Nothing that reveals the answer may leak at start.
    const raw = JSON.stringify(start.body.questions);
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain('explanation');
    const attemptId = start.body.attemptId;

    const wrong = await check(attemptId, {
      questionId: q1.id,
      selectedChoices: [q1.wrong],
    }).expect(201);
    expect(wrong.body).toMatchObject({
      questionId: q1.id,
      isCorrect: false,
      correctChoiceIds: [q1.correct],
      explanation: 'Because **b** is right.',
    });

    const right = await check(attemptId, {
      questionId: q2.id,
      selectedChoices: [q2.correct],
    }).expect(201);
    expect(right.body).toMatchObject({ isCorrect: true, explanation: null });

    // Checked answers are locked. A repeated check returns the stored
    // verdict (so a client that lost its state can recover) with a 409.
    const again = await check(attemptId, {
      questionId: q1.id,
      selectedChoices: [q1.correct],
    }).expect(409);
    expect(again.body.result).toMatchObject({
      questionId: q1.id,
      isCorrect: false,
      selectedChoiceIds: [q1.wrong],
      correctChoiceIds: [q1.correct],
      explanation: 'Because **b** is right.',
    });
    // Interactive attempts never go through the unlocked /answer upsert.
    await request(server)
      .post(`/attempts/${attemptId}/answer`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ questionId: q1.id, selectedChoices: [q1.correct] })
      .expect(400);

    // A tampered submit payload cannot flip the revealed wrong answer.
    const result = await request(server)
      .post(`/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({
        answers: [
          { questionId: q1.id, selectedChoices: [q1.correct] },
          { questionId: q2.id, selectedChoices: [q2.correct] },
        ],
      })
      .expect(201);
    expect(result.body.feedbackMode).toBe('INTERACTIVE');
    expect(result.body.totalCorrect).toBe(1);
    expect(result.body.percentage).toBe(50);
    const r1 = result.body.questionResults.find(
      (r: any) => r.questionId === q1.id,
    );
    expect(r1.correct).toBe(false);
    expect(r1.selectedAnswers).toEqual([q1.wrong]);
    expect(r1.checkedAt).toBeTruthy();

    // After submit the attempt can no longer be checked.
    await check(attemptId, {
      questionId: q2.id,
      selectedChoices: [q2.wrong],
    }).expect(400);
  });

  it('start without a body stays END_OF_EXAM: /check refused, submit grades the payload', async () => {
    const server = app.getHttpServer();
    const start = await request(server)
      .post(`/exams/${examId}/start`)
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(201);
    expect(start.body.feedbackMode).toBe('END_OF_EXAM');
    const attemptId = start.body.attemptId;

    await check(attemptId, {
      questionId: q1.id,
      selectedChoices: [q1.correct],
    }).expect(403);

    const result = await request(server)
      .post(`/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({
        answers: [
          { questionId: q2.id, selectedChoices: [q2.wrong] },
          { questionId: q1.id, selectedChoices: [q1.correct], isMarked: true },
        ],
      })
      .expect(201);
    expect(result.body).toMatchObject({
      feedbackMode: 'END_OF_EXAM',
      totalCorrect: 1,
      totalQuestions: 2,
      percentage: 50,
    });
    // Review keeps the order the answers were submitted in.
    expect(result.body.questionResults.map((r: any) => r.questionId)).toEqual(
      [q2.id, q1.id],
    );
    expect(result.body.questionResults[1].checkedAt).toBeUndefined();

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    expect(exam!.attemptCount).toBe(1);
  });

  it('two concurrent submits of one attempt: exactly one is graded', async () => {
    const attempt = await createAttempt(
      learner.userId,
      FeedbackMode.END_OF_EXAM,
    );
    const submit = () =>
      request(app.getHttpServer())
        .post(`/attempts/${attempt.id}/submit`)
        .set('Authorization', `Bearer ${learner.token}`)
        .send({
          answers: [{ questionId: q1.id, selectedChoices: [q1.correct] }],
        });

    const [a, b] = await Promise.all([submit(), submit()]);

    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    expect(exam!.attemptCount).toBe(1);
    expect(
      await prisma.answer.count({ where: { attemptId: attempt.id } }),
    ).toBe(2);
  });

  it('rejects an unknown feedbackMode and INTERACTIVE on Time Pressure exams', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post(`/exams/${examId}/start`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ feedbackMode: 'SOMETHING_ELSE' })
      .expect(400);

    const tp = await createExam(TimerMode.TIME_PRESSURE);
    await request(server)
      .post(`/exams/${tp.examId}/start`)
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ feedbackMode: 'INTERACTIVE' })
      .expect(400);
  });

  it("refuses another user's attempt, questions outside the exam, and bad choices", async () => {
    const attempt = await createAttempt(
      learner.userId,
      FeedbackMode.INTERACTIVE,
    );
    const other = await createTestUser(app, { suffix: 'interactive-other' });

    await check(
      attempt.id,
      { questionId: q1.id, selectedChoices: [q1.correct] },
      other.token,
    ).expect(403);

    const outside = await createExam(TimerMode.RELAXED);
    await check(attempt.id, {
      questionId: outside.q1.id,
      selectedChoices: [outside.q1.correct],
    }).expect(400);

    await check(attempt.id, {
      questionId: q1.id,
      selectedChoices: [q2.correct],
    }).expect(400);
    await check(attempt.id, {
      questionId: q1.id,
      selectedChoices: [],
    }).expect(400);

    // Nothing was locked by the rejected calls.
    expect(
      await prisma.answer.count({ where: { attemptId: attempt.id } }),
    ).toBe(0);
  });

  it('two concurrent checks of the same question: exactly one wins', async () => {
    const attempt = await createAttempt(
      learner.userId,
      FeedbackMode.INTERACTIVE,
    );

    const [a, b] = await Promise.all([
      check(attempt.id, { questionId: q1.id, selectedChoices: [q1.wrong] }),
      check(attempt.id, { questionId: q1.id, selectedChoices: [q1.correct] }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.answer.count({
        where: { attemptId: attempt.id, questionId: q1.id },
      }),
    ).toBe(1);
  });
});
