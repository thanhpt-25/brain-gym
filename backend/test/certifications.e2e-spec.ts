import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

describe('Certifications CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let testProviderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('JWT_SECRET');

    // Create test admin user
    const admin = await prisma.user.create({
      data: {
        email: 'e2e-cert-admin@test.com',
        passwordHash: 'e2e-test-hash',
        displayName: 'E2E Cert Admin',
        role: UserRole.ADMIN,
      },
    });

    // Clean up any existing test provider and its certifications from failed tests
    const existingCerts = await prisma.certification.findMany({
      where: {
        OR: [
          { code: { startsWith: 'E2E-TEST' } },
          { code: { startsWith: 'E2E-UNIQUE' } },
          { code: { startsWith: 'E2E-UPDATED' } },
        ],
      },
      select: { id: true },
    });
    const existingCertIds = existingCerts.map((c) => c.id);
    if (existingCertIds.length) {
      const exams = await prisma.exam.findMany({
        where: { certificationId: { in: existingCertIds } },
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
      await prisma.question.deleteMany({
        where: { certificationId: { in: existingCertIds } },
      });
      await prisma.certification.deleteMany({
        where: { id: { in: existingCertIds } },
      });
    }

    // Create test provider (reuse if it exists from previous run)
    let provider: typeof prisma.provider.$extends.$result.provider | null =
      null;
    try {
      provider = await prisma.provider.create({
        data: { name: 'E2E Test Provider', slug: 'e2e-test-provider' },
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        // Provider already exists, find it
        provider = await prisma.provider.findUnique({
          where: { slug: 'e2e-test-provider' },
        });
      } else {
        throw error;
      }
    }
    testProviderId = provider!.id;

    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret, expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    // Delete all certifications referencing this provider
    if (testProviderId) {
      const certs = await prisma.certification.findMany({
        where: { providerId: testProviderId },
        select: { id: true },
      });
      const certIds = certs.map((c) => c.id);

      if (certIds.length) {
        const exams = await prisma.exam.findMany({
          where: { certificationId: { in: certIds } },
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

        await prisma.examQuestion.deleteMany({
          where: { question: { certificationId: { in: certIds } } },
        });
        await prisma.choice.deleteMany({
          where: { question: { certificationId: { in: certIds } } },
        });
        await prisma.question.deleteMany({
          where: { certificationId: { in: certIds } },
        });

        await prisma.certification.deleteMany({
          where: { id: { in: certIds } },
        });
      }

      await prisma.provider.delete({ where: { id: testProviderId } });
    }

    // Also clean up any orphaned test certifications created by this test file
    const orphanedCerts = await prisma.certification.findMany({
      where: {
        OR: [
          { code: { startsWith: 'E2E-TEST' } },
          { code: { startsWith: 'E2E-UNIQUE' } },
          { code: { startsWith: 'E2E-UPDATED' } },
        ],
      },
      select: { id: true },
    });
    const orphanedCertIds = orphanedCerts.map((c) => c.id);
    if (orphanedCertIds.length) {
      await prisma.question.deleteMany({
        where: { certificationId: { in: orphanedCertIds } },
      });
      await prisma.certification.deleteMany({
        where: { id: { in: orphanedCertIds } },
      });
    }
    await prisma.user.deleteMany({
      where: { email: 'e2e-cert-admin@test.com' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('should manage certification lifecycle', async () => {
    // 1. Create (POST)
    const createRes = await request(app.getHttpServer())
      .post('/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Test Certification',
        providerId: testProviderId,
        code: 'E2E-TEST-01',
        description: 'E2E test desc',
        domains: ['Domain 1', 'Domain 2'],
      })
      .expect(201);

    const certId = createRes.body.id;
    expect(certId).toBeDefined();
    expect(createRes.body.domains).toHaveLength(2);

    // 2. Read All (GET - public)
    const listRes = await request(app.getHttpServer())
      .get('/certifications')
      .expect(200);
    expect(
      listRes.body.some((c: { id: string }) => c.id === certId),
    ).toBeTruthy();

    // 3. Update (PUT)
    const updateRes = await request(app.getHttpServer())
      .put(`/certifications/${certId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated E2E Name',
        code: 'E2E-UPDATED',
        domains: ['New Domain only'],
      })
      .expect(200);
    expect(updateRes.body.name).toBe('Updated E2E Name');
    expect(updateRes.body.domains).toHaveLength(1);
    expect(updateRes.body.domains[0].name).toBe('New Domain only');

    // 4. Soft Delete (DELETE)
    await request(app.getHttpServer())
      .delete(`/certifications/${certId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify not in public list
    const publicList = await request(app.getHttpServer())
      .get('/certifications')
      .expect(200);
    expect(
      publicList.body.some((c: { id: string }) => c.id === certId),
    ).toBeFalsy();

    // Verify in admin list
    const adminList = await request(app.getHttpServer())
      .get('/certifications?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      adminList.body.some((c: { id: string }) => c.id === certId),
    ).toBeTruthy();
  });

  it('should enforce code uniqueness', async () => {
    const code = 'E2E-UNIQUE-' + Date.now();
    await request(app.getHttpServer())
      .post('/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'First', providerId: testProviderId, code })
      .expect(201);

    await request(app.getHttpServer())
      .post('/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Second', providerId: testProviderId, code })
      .expect(409);
  });
});
