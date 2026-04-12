import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrgRole, QuestionType, Difficulty } from '@prisma/client';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  cleanupByEmail,
  createTestCertification,
  createTestPublicQuestion,
} from './e2e-helpers';

const EMAIL_PREFIX = 'e2e-ques-';

describe('Org Questions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;
  let orgId: string;
  let certId: string;
  let publicQuestionId: string;

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

    await cleanupByEmail(prisma, EMAIL_PREFIX);

    // Setup users
    const owner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}owner@test.com`,
      displayName: 'E2E QOwner',
    });
    ownerToken = generateToken(app, owner);

    const member = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}member@test.com`,
      displayName: 'E2E QMember',
    });
    memberToken = generateToken(app, member);

    // Setup org
    const setup = await createTestOrg(prisma, owner.id, {
      name: 'E2E Question Org',
    });
    orgId = setup.org.id;

    await prisma.orgMember.create({
      data: { orgId, userId: member.id, role: OrgRole.MEMBER },
    });

    // Setup cert & public question (for cloning)
    const certSetup = await createTestCertification(prisma, {
      name: 'E2E Cert',
      code: 'E2E-CERT',
    });
    certId = certSetup.cert.id;

    const pubQ = await createTestPublicQuestion(prisma, {
      certId,
      createdBy: owner.id,
      title: 'E2E Public Subject',
    });
    publicQuestionId = pubQ.id;
  });

  afterAll(async () => {
    // Delete public question
    if (publicQuestionId) {
      await prisma.choice.deleteMany({
        where: { questionId: publicQuestionId },
      });
      await prisma.question.deleteMany({ where: { id: publicQuestionId } });
    }
    // Delete cert
    if (certId) {
      await prisma.certification.deleteMany({ where: { id: certId } });
    }
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  let createdQuestionId: string;

  it('should create an org question as OWNER (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'E2E Private Question',
        difficulty: Difficulty.MEDIUM,
        questionType: QuestionType.SINGLE,
        certificationId: certId,
        choices: [
          { label: 'a', content: 'Wrong', isCorrect: false },
          { label: 'b', content: 'Right', isCorrect: true },
        ],
      })
      .expect(201);

    createdQuestionId = res.body.id;
    expect(createdQuestionId).toBeDefined();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.choices.length).toBe(2);
  });

  it('should list questions with filters (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/questions?status=DRAFT`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(
      res.body.data.some((q: any) => q.id === createdQuestionId),
    ).toBeTruthy();
  });

  it('should get question details (GET /:qid)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBe(createdQuestionId);
    expect(res.body.choices).toBeDefined();
  });

  it('should update question (PATCH /:qid)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated E2E Private Question' })
      .expect(200);

    expect(res.body.title).toBe('Updated E2E Private Question');
  });

  it('should submit question for review (POST /:qid/submit)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/${createdQuestionId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.status).toBe('UNDER_REVIEW');
  });

  it('should deny MEMBER from approving (POST /:qid/approve → 403)', async () => {
    await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/${createdQuestionId}/approve`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('should approve question as OWNER (POST /:qid/approve)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/${createdQuestionId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.status).toBe('APPROVED');
  });

  it('should reject question flow (POST submit + reject)', async () => {
    // create draft
    const createRes = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'To be rejected',
        choices: [{ label: 'a', content: 'Right', isCorrect: true }],
      })
      .expect(201);

    const qid = createRes.body.id;

    // submit
    await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/${qid}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    // reject
    const rejectRes = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/${qid}/reject`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Needs work' })
      .expect(201);

    expect(rejectRes.body.status).toBe('REJECTED');
  });

  it('should clone public question (POST /clone/:sourceId)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/questions/clone/${publicQuestionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.sourceQuestionId).toBe(publicQuestionId);
    expect(res.body.status).toBe('DRAFT');
  });

  it('should delete question (DELETE /:qid)', async () => {
    await request(app.getHttpServer())
      .delete(`/organizations/${orgId}/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/organizations/${orgId}/questions/${createdQuestionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
