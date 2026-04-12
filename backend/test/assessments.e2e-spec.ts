import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrgRole, AssessmentStatus } from '@prisma/client';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  cleanupByEmail,
} from './e2e-helpers';

const EMAIL_PREFIX = 'e2e-assess-';

describe('Candidate Assessments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let orgId: string;
  let orgQuestionId: string;
  let correctChoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await cleanupByEmail(prisma, EMAIL_PREFIX);

    // Setup user
    const owner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}owner@test.com`,
      displayName: 'E2E AOwner',
    });
    ownerToken = generateToken(app, owner);

    // Setup org
    const setup = await createTestOrg(prisma, owner.id, { name: 'E2E Assess Org' });
    orgId = setup.org.id;

    // Create an org question with choices to test the exact evaluation flow
    const oq = await prisma.orgQuestion.create({
      data: {
        orgId,
        createdBy: owner.id,
        title: 'E2E Assess Q',
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
    orgQuestionId = oq.id;
    correctChoiceId = oq.choices.find(c => c.isCorrect)!.id;
  });

  afterAll(async () => {
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  let assessmentId: string;
  let candidateToken: string;

  it('should create assessment (DRAFT) (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/assessments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'E2E Candidate Test',
        timeLimit: 15,
        passingScore: 70,
        detectTabSwitch: true,
        questions: [{ orgQuestionId, sortOrder: 0 }],
      })
      .expect(201);

    assessmentId = res.body.id;
    expect(assessmentId).toBeDefined();
    expect(res.body.status).toBe(AssessmentStatus.DRAFT);
  });

  it('should list assessments (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/assessments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.data.some((a: any) => a.id === assessmentId)).toBeTruthy();
  });

  it('should get assessment detail (GET /:aid)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBe(assessmentId);
  });

  it('should update assessment (PATCH /:aid)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated E2E Candidate Test' })
      .expect(200);

    expect(res.body.title).toBe('Updated E2E Candidate Test');
  });

  it('should activate assessment (PATCH /:aid/status)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/assessments/${assessmentId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: AssessmentStatus.ACTIVE })
      .expect(200);

    expect(res.body.status).toBe(AssessmentStatus.ACTIVE);
  });

  it('should invite candidates (POST /:aid/invite)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/assessments/${assessmentId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        candidates: [{ email: 'candidate@test.com', name: 'John Doe' }],
      })
      .expect(201);

    expect(res.body.invited).toBe(1);
    
    // Fetch the token directly from DB just for testing the public flow
    const invite = await prisma.candidateInvite.findFirst({
      where: { assessmentId },
    });
    expect(invite).toBeDefined();
    candidateToken = invite!.token;
  });

  // ─── PUBLIC ROUTES (Candidate Flow) ──────────────────────────────────────────

  it('should load assessment info publicly (GET /take/:token)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assessments/take/${candidateToken}`)
      .expect(200);

    expect(res.body.title).toBe('Updated E2E Candidate Test');
    expect(res.body.timeLimit).toBe(15);
    expect(res.body.status).toBe('INVITED');
    expect(res.body.candidateName).toBe('John Doe');
  });

  it('should start attempt publicly (POST /take/:token/start)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/assessments/take/${candidateToken}/start`)
      .expect(201); // Nest router generic POST wraps to 201

    expect(res.body.totalQuestions).toBe(1);
    expect(res.body.questions[0].choices).toBeDefined();
    // Correct flags shouldn't be exposed
    expect(res.body.questions[0].choices[0].isCorrect).toBeUndefined();
  });

  it('should report tab switch publicly (POST /take/:token/event)', async () => {
    await request(app.getHttpServer())
      .post(`/assessments/take/${candidateToken}/event`)
      .send({ eventType: 'tab_switch' })
      .expect(201);

    // Verify DB
    const invite = await prisma.candidateInvite.findUnique({ where: { token: candidateToken } });
    expect(invite?.tabSwitchCount).toBe(1);
  });

  it('should submit attempt successfully (POST /take/:token/submit)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/assessments/take/${candidateToken}/submit`)
      .send({
        answers: [{ questionId: orgQuestionId, selectedChoices: [correctChoiceId] }],
      })
      .expect(201);

    expect(res.body.score).toBe(100);
    expect(res.body.passed).toBe(true);
    expect(res.body.totalCorrect).toBe(1);
  });

  it('should reject expired/submitted tokens publicly (GET /take/:token)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/assessments/take/${candidateToken}/submit`)
      .send({ answers: [] })
      .expect(400); // 400 or 410 depending on implementation layer
    
    expect(res.body.message).toContain('already submitted');
  });

  // ─── ADMIN VALIDATION ────────────────────────────────────────────────────────
  
  it('should see results as admin (GET /:aid/results)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/assessments/${assessmentId}/results`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.candidates.some((c: any) => c.candidateEmail === 'candidate@test.com')).toBeTruthy();
    const candidate = res.body.candidates.find((c: any) => c.candidateEmail === 'candidate@test.com');
    expect(candidate.status).toBe('SUBMITTED');
    expect(candidate.score).toBe('100');
  });
});
