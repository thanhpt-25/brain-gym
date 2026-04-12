import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrgRole, ExamCatalogItemType } from '@prisma/client';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  cleanupByEmail,
  createTestCertification,
  createTestPublicQuestion,
  cleanupCertByCode,
} from './e2e-helpers';

const EMAIL_PREFIX = 'e2e-catalog-';

describe('Exam Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;
  let memberId: string;
  let orgId: string;
  let certId: string;
  let publicQuestionId: string;
  let orgQuestionId: string;

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
    await cleanupCertByCode(prisma, 'E2E-CAT');

    // Users
    const owner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}owner@test.com`,
      displayName: 'E2E COwner',
    });
    ownerToken = generateToken(app, owner);

    const member = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}member@test.com`,
      displayName: 'E2E CMember',
    });
    memberId = member.id;
    memberToken = generateToken(app, member);

    // Org
    const setup = await createTestOrg(prisma, owner.id, {
      name: 'E2E Catalog Org',
    });
    orgId = setup.org.id;

    const orgMember = await prisma.orgMember.create({
      data: { orgId, userId: member.id, role: OrgRole.MEMBER },
    });
    memberId = orgMember.id;

    // Cert & Public Question
    const certSetup = await createTestCertification(prisma, {
      name: 'E2E Catalog Cert',
      code: 'E2E-CAT',
    });
    certId = certSetup.cert.id;

    const pubQ = await createTestPublicQuestion(prisma, {
      certId,
      createdBy: owner.id,
      title: 'E2E Catalog Public Q',
    });
    publicQuestionId = pubQ.id;

    // Org Question
    const oq = await prisma.orgQuestion.create({
      data: {
        orgId,
        createdBy: owner.id,
        title: 'E2E Catalog Org Q',
        status: 'APPROVED',
        certificationId: certId,
        choices: {
          create: [
            { label: 'a', content: 'Wrong', isCorrect: false, sortOrder: 0 },
            { label: 'b', content: 'Right', isCorrect: true, sortOrder: 1 },
          ],
        },
      },
    });
    orgQuestionId = oq.id;
  });

  afterAll(async () => {
    if (publicQuestionId) {
      await prisma.examQuestion.deleteMany({
        where: { questionId: publicQuestionId },
      });
      await prisma.choice.deleteMany({
        where: { questionId: publicQuestionId },
      });
      await prisma.question.delete({ where: { id: publicQuestionId } });
    }
    if (certId) {
      const exams = await prisma.exam.findMany({
        where: { certificationId: certId },
        select: { id: true },
      });
      const examIds = exams.map((e) => e.id);
      if (examIds.length) {
        await prisma.examAttempt.deleteMany({
          where: { examId: { in: examIds } },
        });
        await prisma.exam.deleteMany({
          where: { id: { in: examIds } },
        });
      }
      await prisma.certification.delete({ where: { id: certId } });
    }
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  let catalogItemId: string;
  let trackId: string;

  it('should create learning track (POST /tracks)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/tracks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Track' })
      .expect(201);

    trackId = res.body.id;
    expect(trackId).toBeDefined();
  });

  it('should create catalog item (FIXED) (POST /catalog)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/catalog`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'E2E Exam',
        type: ExamCatalogItemType.FIXED,
        certificationId: certId,
        questionCount: 1,
        timeLimit: 30,
        trackId,
        questions: [{ publicQuestionId: publicQuestionId, sortOrder: 0 }],
      })
      .expect(201);

    catalogItemId = res.body.id;
    expect(catalogItemId).toBeDefined();
  });

  it('should list catalog (admin view) (GET /catalog/manage)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/catalog/manage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.data.some((i: any) => i.id === catalogItemId)).toBeTruthy();
  });

  it('should list catalog (member view) (GET /catalog)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/catalog`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.data.some((i: any) => i.id === catalogItemId)).toBeTruthy();
  });

  it('should get catalog item detail (GET /catalog/:cid)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/catalog/${catalogItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBe(catalogItemId);
    expect(res.body.questions).toBeDefined();
  });

  it('should update catalog item (PATCH /catalog/:cid)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/catalog/${catalogItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated E2E Exam' })
      .expect(200);

    expect(res.body.title).toBe('Updated E2E Exam');
  });

  it('should assign exam to member (POST /catalog/:cid/assign)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/catalog/${catalogItemId}/assign`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ memberId })
      .expect(201);

    expect(res.body.memberId).toBe(memberId);
  });

  it('should get my assignments (GET /my-assignments)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/my-assignments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(
      res.body.some((a: any) => a.catalogItemId === catalogItemId),
    ).toBeTruthy();
  });

  it('should start catalog exam (POST /catalog/:cid/start)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/catalog/${catalogItemId}/start`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201); // Created

    expect(res.body.attemptId).toBeDefined();
    expect(res.body.questions.length).toBe(1);
  });

  it('should delete track and unlink items (DELETE /tracks/:tid)', async () => {
    await request(app.getHttpServer())
      .delete(`/organizations/${orgId}/tracks/${trackId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const item = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/catalog/${catalogItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(item.body.trackId).toBeNull();
  });

  it('should delete catalog item (DELETE /catalog/:cid)', async () => {
    await request(app.getHttpServer())
      .delete(`/organizations/${orgId}/catalog/${catalogItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/organizations/${orgId}/catalog/${catalogItemId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
