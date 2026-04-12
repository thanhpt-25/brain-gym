import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrgRole } from '@prisma/client';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  cleanupByEmail,
  createTestCertification,
  cleanupCertByCode,
} from './e2e-helpers';

const EMAIL_PREFIX = 'e2e-analytics-';

describe('Org Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let memberToken: string;
  let memberId: string;
  let orgId: string;
  let certId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await cleanupCertByCode(prisma, 'E2E-ANA');

    // Setup users
    const owner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}owner@test.com`,
      displayName: 'E2E Owner Analytics',
    });
    ownerToken = generateToken(app, owner);

    const member = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}member@test.com`,
      displayName: 'E2E Member Analytics',
    });
    memberId = member.id;
    memberToken = generateToken(app, member);

    // Setup org
    const setup = await createTestOrg(prisma, owner.id, { name: 'E2E Analytics Org' });
    orgId = setup.org.id;

    await prisma.orgMember.create({
      data: { orgId, userId: member.id, role: OrgRole.MEMBER },
    });

    // Setup Certification for exams
    const certSetup = await createTestCertification(prisma, {
      name: 'E2E Analytics Cert',
      code: 'E2E-A-CERT',
    });
    certId = certSetup.cert.id;

    // We simulate an exam and attempt so the analytics endpoints have data
    const exam = await prisma.exam.create({
      data: {
        certificationId: certId,
        createdBy: member.id,
        title: '[catalog:dummy] E2E Exam',
        questionCount: 1,
        timeLimit: 10,
        visibility: 'PRIVATE',
      },
    });

    await prisma.examAttempt.create({
      data: {
        userId: member.id,
        examId: exam.id,
        status: 'SUBMITTED',
        score: 80,
        totalQuestions: 1,
        totalCorrect: 1,
      },
    });
  });

  afterAll(async () => {
    if (certId) {
      await prisma.certification.delete({ where: { id: certId } }).catch(() => {}); // might have cascaded
    }
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  it('should get analytics overview (GET /overview)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/overview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.memberCount).toBe(2);
    expect(res.body.totalExamsTaken).toBe(1);
    expect(res.body.avgScore).toBe(80);
  });

  it('should get readiness metrics (GET /readiness)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/readiness`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
  });

  it('should get skill gaps (GET /skill-gaps)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/skill-gaps`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // It should just return array 200 ok (it might be empty without proper domain-level data seeding)
    expect(res.body).toBeInstanceOf(Array);
  });

  it('should get progress trends (GET /progress)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/progress?weeks=4`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
  });

  it('should get member rank/engagement (GET /engagement)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/engagement`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.totalMembers).toBeDefined();
    expect(res.body.totalExamsTaken).toBe(1);
  });

  it('should get individual member stats (GET /member/:userId)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/member/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.member.userId).toBe(memberId);
    expect(res.body.summary.totalExams).toBe(1);
    expect(res.body.summary.avgScore).toBe(80);
  });

  it('should deny MEMBER from accessing org analytics (GET /overview → 403)', async () => {
    await request(app.getHttpServer())
      .get(`/organizations/${orgId}/analytics/overview`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });
});
