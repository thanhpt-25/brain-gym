import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDb, createAdminUser, getOrCreateProvider } from './helpers';

describe('Certifications CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Refreshed in beforeEach after cleanDb
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
  });

  beforeEach(async () => {
    await cleanDb(prisma as any);

    const admin = await createAdminUser(app, 'cert-admin');
    adminToken = admin.token;

    const provider = await getOrCreateProvider(prisma, 'e2e-cert-provider');
    testProviderId = provider.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
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
    const code = 'E2E-UNIQUE-01';
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
